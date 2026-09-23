package com.margins.auth.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.auth.dto.EmailVerificationResponse;
import com.margins.auth.dto.NativeTurnstileBridgeCompleteRequest;
import com.margins.auth.dto.NativeTurnstileBridgeCreateRequest;
import com.margins.auth.dto.NativeTurnstileBridgeCreateResponse;
import com.margins.auth.dto.NativeTurnstileBridgeRedeemRequest;
import com.margins.auth.service.NativeTurnstileBridgeService;
import com.margins.auth.support.ClientIpResolver;
import com.margins.common.dto.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.security.SecureRandom;
import java.util.Base64;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.util.HtmlUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/mobile/email-verification-bridge")
public class NativeTurnstileBridgeController {
    private static final SecureRandom RANDOM = new SecureRandom();

    private final NativeTurnstileBridgeService bridgeService;
    private final ClientIpResolver clientIpResolver;
    private final ObjectMapper objectMapper;

    public NativeTurnstileBridgeController(
        NativeTurnstileBridgeService bridgeService,
        ClientIpResolver clientIpResolver,
        ObjectMapper objectMapper
    ) {
        this.bridgeService = bridgeService;
        this.clientIpResolver = clientIpResolver;
        this.objectMapper = objectMapper;
    }

    /** [Mobile API] 이메일 인증용 일회성 Turnstile bridge와 hosted URL을 생성한다. */
    @PostMapping
    public ResponseEntity<ApiResponse<NativeTurnstileBridgeCreateResponse>> create(
        @Valid @RequestBody NativeTurnstileBridgeCreateRequest request,
        HttpServletRequest httpRequest
    ) {
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .header("Referrer-Policy", "no-referrer")
            .body(ApiResponse.ok(bridgeService.create(
                request.getEmail(), clientIpResolver.resolve(httpRequest))));
    }

    /** [Mobile API] 시스템 브라우저에서 Turnstile challenge를 수행할 hosted page를 제공한다. */
    @GetMapping(value = "/{bridgeId}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> hostedChallenge(@PathVariable String bridgeId)
        throws JsonProcessingException {
        bridgeService.requireActive(bridgeId);
        String nonce = nonce();
        String html = hostedHtml(
            HtmlUtils.htmlEscape(bridgeService.siteKey()),
            objectMapper.writeValueAsString(bridgeService.returnUri()),
            nonce
        );
        return ResponseEntity.ok()
            .contentType(MediaType.TEXT_HTML)
            .cacheControl(CacheControl.noStore())
            .header("Content-Security-Policy",
                "default-src 'none'; script-src 'nonce-" + nonce
                    + "' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; "
                    + "connect-src 'self'; style-src 'nonce-" + nonce + "'; base-uri 'none'; form-action 'none'")
            .header("Referrer-Policy", "no-referrer")
            .header("X-Content-Type-Options", "nosniff")
            .header("X-Frame-Options", "DENY")
            .body(html);
    }

    /** [Mobile API] hosted page가 전달한 Turnstile token을 검증하고 bridge를 완료한다. */
    @PostMapping("/{bridgeId}/complete")
    public ResponseEntity<Void> complete(
        @PathVariable String bridgeId,
        @Valid @RequestBody NativeTurnstileBridgeCompleteRequest request,
        HttpServletRequest httpRequest
    ) {
        bridgeService.complete(bridgeId, request.getToken(), clientIpResolver.resolve(httpRequest));
        return ResponseEntity.noContent()
            .cacheControl(CacheControl.noStore())
            .header("Referrer-Policy", "no-referrer")
            .build();
    }

    /** [Mobile API] 앱이 완료된 bridge proof를 한 번 소비하고 이메일 인증 코드를 요청한다. */
    @PostMapping("/redeem")
    public ResponseEntity<ApiResponse<EmailVerificationResponse>> redeem(
        @Valid @RequestBody NativeTurnstileBridgeRedeemRequest request,
        HttpServletRequest httpRequest
    ) {
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .header("Referrer-Policy", "no-referrer")
            .body(ApiResponse.ok(bridgeService.redeem(
                request.getEmail(),
                request.getBridgeId(),
                request.getNativeProof(),
                clientIpResolver.resolve(httpRequest)
            )));
    }

    private String nonce() {
        byte[] value = new byte[18];
        RANDOM.nextBytes(value);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }

    private String hostedHtml(String siteKey, String returnUriJson, String nonce) {
        return """
            <!doctype html>
            <html lang="en">
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width,initial-scale=1">
                <meta name="referrer" content="no-referrer">
                <title>Margins verification</title>
                <script nonce="%1$s" src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" defer></script>
                <style nonce="%1$s">
                  body{font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f0e6;color:#14213d}
                  main{max-width:24rem;padding:2rem;text-align:center} #challenge{min-height:70px;margin:1.5rem auto}
                </style>
              </head>
              <body>
                <main><h1>Verify you are human</h1><p>Complete the check, then return to Margins.</p><div id="challenge"></div><p id="status" role="status" aria-live="polite"></p></main>
                <script nonce="%1$s">
                  const statusNode=document.getElementById('status');
                  const returnUri=%3$s;
                  async function complete(token){
                    statusNode.textContent='Verifying…';
                    const response=await fetch(location.pathname+'/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
                    if(!response.ok){statusNode.textContent='Verification failed. Please retry.';turnstile.reset();return;}
                    statusNode.textContent='Verified. Returning to Margins…';
                    location.replace(returnUri);
                  }
                  addEventListener('load',()=>turnstile.render('#challenge',{sitekey:'%2$s',action:'email_verification',callback:complete,'expired-callback':()=>statusNode.textContent='Challenge expired. Please retry.','error-callback':()=>statusNode.textContent='Challenge unavailable. Please retry.'}));
                </script>
              </body>
            </html>
            """.formatted(nonce, siteKey, returnUriJson);
    }
}
