import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
    return proxyRequest(request, params.path);
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
    return proxyRequest(request, params.path);
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
    return proxyRequest(request, params.path);
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
    return proxyRequest(request, params.path);
}

async function proxyRequest(request: NextRequest, pathSegments: string[]) {
    const path = pathSegments.join('/');
    const targetUrl = `http://43.204.221.192/${path}${request.nextUrl.search}`;

    const headers = new Headers(request.headers);
    headers.set('Host', '43.204.221.192'); // Ensure the target server isn't confused

    try {
        const fetchOptions: RequestInit = {
            method: request.method,
            headers: headers,
            body: request.method !== 'GET' ? await request.blob() : undefined,
            cache: 'no-store'
        };

        const response = await fetch(targetUrl, fetchOptions);
        const responseData = await response.blob();

        return new NextResponse(responseData, {
            status: response.status,
            headers: response.headers
        });
    } catch (error: any) {
        return NextResponse.json({ error: 'Proxy Logic Failed', details: error.message }, { status: 502 });
    }
}
