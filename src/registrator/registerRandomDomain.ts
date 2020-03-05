import fetch from "node-fetch";

export async function registerRandomDomain(registrator: string = 'https://registrator.orcarium.com') {
    let registration = await fetch(registrator + '/random', { method: 'POST', body: '' });
    if (!registration.ok) {
        throw Error('Unexpected error');
    }
    let res = await registration.json();
    if (typeof res.token !== 'string') {
        throw Error('Mailformed response');
    }
    if (typeof res.host !== 'string') {
        throw Error('Mailformed response');
    }

    return {
        host: res.host as string,
        token: res.token as string
    };
}