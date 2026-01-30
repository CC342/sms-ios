export default {
  async fetch(request, env, ctx) {
    const TIME_ZONE = "Asia/Seoul"; 

    // 1. 跨域与请求方式检查
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // 2. 鉴权
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${env.API_TOKEN}`) {
      return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), { 
        status: 401, headers: { "Content-Type": "application/json" }
      });
    }

    try {
      const body = await request.json();
      const content = String(body.content || "").trim();
      const device = body.device || "Unknown Device";
      const timestamp = body.timestamp || Date.now();
      
      // 3. 内容校验
      if (!content) {
        return new Response(JSON.stringify({ success: false, message: "Content empty" }), { 
            status: 400, headers: { "Content-Type": "application/json" }
        });
      }

      // 4. 提取验证码
      let code = body.code;
      if (!code) {
        const patterns = [
            /(?:验证码|code|校验码|动态码).*?(\d{4,8})/i,
            /(\d{4,8}).*?(?:验证码|code|校验码|动态码)/i,
            /\b(\d{4,6})\b/
        ];
        for (const p of patterns) {
            const match = content.match(p);
            if (match && match[1]) {
                code = match[1];
                break;
            }
        }
      }

      // 5. KV 去重与备份
      if (env.SMS_CACHE) {
         const msgFingerprint = await hash(`${content}-${timestamp}`);
         const isDuplicated = await env.SMS_CACHE.get(msgFingerprint);
         const isDebug = new URL(request.url).searchParams.get("debug") === "true";

         if (isDuplicated && !isDebug) {
             return new Response(JSON.stringify({ success: true, message: "Duplicate skipped" }), {
                 headers: { "Content-Type": "application/json" }
             });
         }
         
         await env.SMS_CACHE.put(msgFingerprint, "1", { expirationTtl: 600 });

         const logKey = `log:${Date.now()}`;
         const logData = JSON.stringify({
             device: device,
             content: content,
             code: code,
             rawTimestamp: timestamp,
             saveTime: new Date().toLocaleString("zh-CN", {timeZone: TIME_ZONE})
         });
         await env.SMS_CACHE.put(logKey, logData, { expirationTtl: 2592000 });
      }

      // 6. 发送 (传入配置好的时区)
      const pushResult = await sendToWeComText(env, content, code, device, TIME_ZONE);

      return new Response(JSON.stringify({
        success: true,
        message: "forwarded",
        wecom_response: pushResult
      }), {
        headers: { "Content-Type": "application/json" }
      });

    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), { 
        status: 500, headers: { "Content-Type": "application/json" }
      });
    }
  },
};

/**
 * 发送纯文本消息
 */
async function sendToWeComText(env, content, code, device, timeZone) {
  const { WECOM_CORPID, WECOM_SECRET, WECOM_AGENTID } = env;

  if (!WECOM_CORPID || !WECOM_SECRET || !WECOM_AGENTID) {
    throw new Error("企业微信配置缺失");
  }

  // 1. 获取 Token
  const tokenUrl = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${WECOM_CORPID}&corpsecret=${WECOM_SECRET}`;
  const tokenResp = await fetch(tokenUrl);
  const tokenData = await tokenResp.json();

  if (!tokenData.access_token) {
    return { error: "Get Token Failed", detail: tokenData };
  }

  // 2. 构建内容 (使用指定的时区)
  const timeStr = new Date().toLocaleString('zh-CN', {timeZone: timeZone, hour12: false});
  let textContent = "";

  if (code) {
    textContent = `🚀 【收到验证码】\n` +
                  `----------------\n` +
                  `验证码：${code}\n` +
                  `----------------\n` +
                  `内容：${content}\n\n` +
                  `📱 设备：${device}\n` +
                  `⏰ 时间：${timeStr}`;
  } else {
    textContent = `📩 【收到新短信】\n` +
                  `----------------\n` +
                  `内容：${content}\n\n` +
                  `📱 设备：${device}\n` +
                  `⏰ 时间：${timeStr}`;
  }

  const payload = {
    touser: "@all",
    msgtype: "text",
    agentid: WECOM_AGENTID,
    text: {
      content: textContent
    }
  };

  // 3. 推送
  const sendUrl = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${tokenData.access_token}`;
  const sendResp = await fetch(sendUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return await sendResp.json();
}

/**
 * 哈希工具
 */
async function hash(string) {
  const utf8 = new TextEncoder().encode(string);
  const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
