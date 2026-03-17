import { http, HttpResponse, type JsonBodyType } from "msw";

export function jsonRpcHandler(
  url: string,
  method: string,
  result: JsonBodyType,
  id?: number,
) {
  return http.post(url, async ({ request }) => {
    const body = (await request.json()) as { method: string; id: number };
    if (body.method !== method) {
      return HttpResponse.json(
        { error: { message: `unexpected method: ${body.method}` } },
        { status: 400 },
      );
    }
    return HttpResponse.json({ result: [result], id: id ?? body.id });
  });
}

export function mockGetEndpoint(url: string, data: JsonBodyType, status = 200) {
  return http.get(url, () => HttpResponse.json(data, { status }));
}

export function mockPostEndpoint(url: string, data: JsonBodyType, status = 200) {
  return http.post(url, () => HttpResponse.json(data, { status }));
}

export function mockErrorEndpoint(
  url: string,
  method: "get" | "post",
  status: number,
  body?: JsonBodyType,
) {
  const handler = method === "get" ? http.get : http.post;
  return handler(url, () =>
    HttpResponse.json(body ?? { error: "error" }, { status }),
  );
}
