export function exponentialBackoffDelay(currentFailureCount: number, minDelay: number, maxDelay: number, maxFailureCount: number) {
    let maxDelayRet = minDelay + ((maxDelay - minDelay) / maxFailureCount) * Math.max(currentFailureCount, maxFailureCount);
    return Math.round(Math.random() * maxDelayRet);
}

export async function delay(ms: number) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

export async function backoff<T>(callback: () => Promise<T>): Promise<T> {
    let currentFailureCount = 0;
    const minDelay = 500;
    const maxDelay = 15000;
    const maxFailureCount = 50;
    while (true) {
        try {
            return await callback();
        } catch (e) {
            if (currentFailureCount > 3) {
                console.warn(e);
            }
            if (currentFailureCount < maxFailureCount) {
                currentFailureCount++;
            }

            let waitForRequest = exponentialBackoffDelay(currentFailureCount, minDelay, maxDelay, maxFailureCount);
            await delay(waitForRequest);
        }
    }
}