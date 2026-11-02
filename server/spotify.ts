interface SpotifyOptions {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  basePath: string;
  fetch?: typeof fetch;
}

interface Session {
  expires: number;
  state?: string;
  redirectUri: string;
  returnTo: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpires?: number;
  error?: string;
  refreshing?: Promise<void>;
}

const SCOPES =
  "streaming user-read-email user-read-private user-modify-playback-state";
const COOKIE = "mediatunes_spotify";

export function createSpotifyHandler(options: SpotifyOptions) {
  const sessions = new Map<string, Session>();
  const request = options.fetch ?? fetch;
  const prefix = `${options.basePath}/spotify`;
  const configured = Boolean(options.clientId && options.clientSecret);
  const redirectOrigin = options.redirectUri
    ? new URL(options.redirectUri).origin
    : undefined;

  function json(body: unknown, status = 200): Response {
    return Response.json(body, {
      status,
      headers: { "cache-control": "no-store" },
    });
  }

  function cookie(id: string, secure: boolean, maxAge = 604800): string {
    return `${COOKIE}=${id}; HttpOnly; SameSite=Lax; Path=${prefix}; Max-Age=${maxAge}${
      secure ? "; Secure" : ""
    }`;
  }

  async function exchange(
    session: Session,
    params: URLSearchParams,
  ): Promise<void> {
    const response = await request("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        authorization: `Basic ${
          btoa(`${options.clientId}:${options.clientSecret}`)
        }`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: params,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      if (response.status === 400 || response.status === 401) {
        session.accessToken = undefined;
        session.refreshToken = undefined;
      }
      throw new Error(
        `Spotify token request failed (${response.status}). Please reconnect Spotify.`,
      );
    }
    const data: unknown = await response.json();
    if (
      typeof data !== "object" || data === null ||
      !("access_token" in data) || typeof data.access_token !== "string" ||
      !("expires_in" in data) || typeof data.expires_in !== "number" ||
      !Number.isFinite(data.expires_in) || data.expires_in <= 0
    ) throw new Error("Spotify returned an invalid token response.");
    session.accessToken = data.access_token;
    session.tokenExpires = Date.now() + data.expires_in * 1000;
    if ("refresh_token" in data && typeof data.refresh_token === "string") {
      session.refreshToken = data.refresh_token;
    }
    session.error = undefined;
  }

  return async function handleSpotify(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const publicOrigin = redirectOrigin ?? url.origin;
    const path = url.pathname.slice(prefix.length);
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (session.expires <= now) sessions.delete(id);
    }
    const id = req.headers.get("cookie")?.split(";").map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    const session = id ? sessions.get(id) : undefined;
    const secure = url.protocol === "https:" ||
      options.redirectUri?.startsWith("https:") === true;
    const origin = req.headers.get("origin");
    if (
      (origin && origin !== publicOrigin) ||
      req.headers.get("sec-fetch-site") === "cross-site" && path !== "/callback"
    ) {
      return json(
        { error: "Cross-origin Spotify requests are not allowed." },
        403,
      );
    }

    if (path === "/status" && req.method === "GET") {
      return json({
        configured,
        authenticated: Boolean(session?.accessToken),
        error: session?.error,
      });
    }
    if (path === "/logout" && req.method === "POST") {
      if (id) sessions.delete(id);
      const response = json({ authenticated: false });
      response.headers.set("set-cookie", cookie("", secure, 0));
      return response;
    }
    if (!configured) {
      return json({
        error:
          "Set SPOTIFY_API_CLIENT_ID and SPOTIFY_API_CLIENT_SECRET on the web server to enable Spotify.",
      }, 503);
    }

    if (path === "/login" && req.method === "GET") {
      const returnTo = url.searchParams.get("returnTo") ??
        `${options.basePath}/player`;
      if (!URL.canParse(returnTo, publicOrigin)) {
        return json({ error: "Invalid Spotify return URL." }, 400);
      }
      const returnUrl = new URL(
        returnTo,
        publicOrigin,
      );
      if (
        returnUrl.origin !== publicOrigin ||
        !returnUrl.pathname.startsWith(`${options.basePath}/`) ||
        returnUrl.pathname.startsWith(`${prefix}/`)
      ) {
        return json({ error: "Invalid Spotify return URL." }, 400);
      }
      if (id) sessions.delete(id);
      const nextId = crypto.randomUUID();
      const state = crypto.randomUUID();
      const redirectUri = options.redirectUri ??
        `${url.origin}${prefix}/callback`;
      sessions.set(nextId, {
        state,
        redirectUri,
        returnTo: `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`,
        expires: now + 10 * 60 * 1000,
      });
      const authorize = new URL("https://accounts.spotify.com/authorize");
      authorize.search = new URLSearchParams({
        response_type: "code",
        client_id: options.clientId!,
        redirect_uri: redirectUri,
        scope: SCOPES,
        state,
      }).toString();
      return new Response(null, {
        status: 302,
        headers: {
          location: authorize.href,
          "set-cookie": cookie(nextId, secure),
          "cache-control": "no-store",
        },
      });
    }
    if (path === "/callback" && req.method === "GET") {
      if (!session?.state || session.state !== url.searchParams.get("state")) {
        return json({
          error:
            "Spotify login expired or has an invalid state. Start login again.",
        }, 400);
      }
      session.state = undefined;
      session.expires = now + 7 * 24 * 60 * 60 * 1000;
      const code = url.searchParams.get("code");
      if (url.searchParams.has("error") || !code) {
        session.error =
          "Spotify authorization was declined or did not return a code.";
      } else {
        try {
          await exchange(
            session,
            new URLSearchParams({
              grant_type: "authorization_code",
              code,
              redirect_uri: session.redirectUri,
            }),
          );
        } catch (error) {
          console.error("Spotify authorization failed:", error);
          session.error = error instanceof Error
            ? error.message
            : "Spotify authorization failed.";
        }
      }
      return new Response(null, {
        status: 302,
        headers: { location: session.returnTo, "cache-control": "no-store" },
      });
    }
    if (path === "/token" && req.method === "GET") {
      if (!session?.accessToken) {
        return json({
          error: "Connect your Spotify Premium account to play music.",
        }, 401);
      }
      try {
        if ((session.tokenExpires ?? 0) <= now + 60000) {
          if (!session.refreshToken) {
            session.accessToken = undefined;
            session.error = "Spotify login expired. Please reconnect Spotify.";
            return json({
              error: session.error,
            }, 401);
          }
          if (!session.refreshing) {
            session.refreshing = exchange(
              session,
              new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: session.refreshToken,
              }),
            ).finally(() => {
              session.refreshing = undefined;
            });
          }
          await session.refreshing;
        }
        return json({ accessToken: session.accessToken });
      } catch (error) {
        console.error("Spotify token refresh failed:", error);
        return json({
          error: error instanceof Error
            ? error.message
            : "Spotify token refresh failed.",
        }, 502);
      }
    }
    return json(
      { error: "Unknown Spotify endpoint or unsupported method." },
      404,
    );
  };
}
