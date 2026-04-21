export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // Intercept requests to our proxy path
        if (url.pathname.startsWith('/api/proxy/')) {
            // Reconstruct the target URL (AWS Backend)
            // Path structure: /api/proxy/api/auth/login -> http://43.204.221.192/api/auth/login
            const targetPath = url.pathname.replace('/api/proxy/', '');
            const targetUrl = `http://43.204.221.192/${targetPath}${url.search}`;

            // Create a new request to the backend
            const modifiedRequest = new Request(targetUrl, {
                method: request.method,
                headers: request.headers,
                body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.blob() : null,
                redirect: 'follow'
            });

            // Add Host header to avoid IP rejection
            modifiedRequest.headers.set('Host', '43.204.221.192');

            try {
                return await fetch(modifiedRequest);
            } catch (err) {
                return new Response(`Proxy Error: ${err.message}`, { status: 502 });
            }
        }

        // Otherwise, fall back to the static site content
        return env.ASSETS.fetch(request);
    }
};
