import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { AuthFlowVisualizer } from "@/components/visualizers/AuthFlowVisualizer";
import { BilingualContent } from "@/components/docs/BilingualContent";

export const metadata = { title: "Authentication" };

const authResponseParamsEN = [
  {
    name: "AuthenticationResponse.Accept()",
    type: "static AuthenticationResponse",
    description: "Returns an accepted response. The client is allowed to join the session and will receive the full game state.",
  },
  {
    name: "AuthenticationResponse.Deny(TDenial reason)",
    type: "static AuthenticationResponse",
    description: "Returns a denial response with a typed reason payload. The reason is serialized and sent back to the client before the connection is closed.",
  },
  {
    name: "GetClientPayload()",
    type: "abstract TPayload",
    description: "Runs on the client. Build and return the credentials object to be sent to the server (e.g. a token, username+password hash, or steam ticket).",
  },
  {
    name: "ValidateClientPayload(PlayerID conn, TPayload payload)",
    type: "abstract AuthenticationResponse",
    description: "Runs on the server. Inspect the received payload and return Accept() or Deny(reason). Throw an exception to deny with a generic error.",
  },
  {
    name: "UnAuthenticateClient(PlayerID conn)",
    type: "virtual void",
    description: "Runs on the server when an authenticated client disconnects. Use to release server-side resources associated with that connection.",
  },
];

const authResponseParamsTH = [
  {
    name: "AuthenticationResponse.Accept()",
    type: "static AuthenticationResponse",
    description: "คืน accepted response Client ได้รับอนุญาตให้เข้าร่วม session และจะได้รับ game state ทั้งหมด",
  },
  {
    name: "AuthenticationResponse.Deny(TDenial reason)",
    type: "static AuthenticationResponse",
    description: "คืน denial response พร้อม typed reason payload reason จะถูก serialize และส่งกลับไปยัง client ก่อนที่ connection จะถูกปิด",
  },
  {
    name: "GetClientPayload()",
    type: "abstract TPayload",
    description: "ทำงานบน client สร้างและคืน credentials object ที่จะส่งไปยัง server (เช่น token, username+password hash หรือ steam ticket)",
  },
  {
    name: "ValidateClientPayload(PlayerID conn, TPayload payload)",
    type: "abstract AuthenticationResponse",
    description: "ทำงานบน server ตรวจสอบ payload ที่ได้รับและคืน Accept() หรือ Deny(reason) Throw exception เพื่อ deny ด้วย generic error",
  },
  {
    name: "UnAuthenticateClient(PlayerID conn)",
    type: "virtual void",
    description: "ทำงานบน server เมื่อ authenticated client disconnect ใช้เพื่อ release server-side resources ที่เกี่ยวข้องกับ connection นั้น",
  },
];

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="Authentication"
          description="PurrNet's authentication system validates each connecting client before they are allowed to participate in the game. Subclass AuthenticationBehaviour to supply credentials from the client and validate them on the server."
          badge="Advanced"
          href="/docs/authentication"
        >
          <div className="not-prose mb-6">
            <AuthFlowVisualizer />
          </div>

          <div className="prose">
            <h2>How it works</h2>
            <p>
              When a client connects, PurrNet calls <code>GetClientPayload()</code> on the client
              side. The returned payload (any serializable type) is sent to the server, where{" "}
              <code>ValidateClientPayload()</code> runs. Based on the result, the server either
              accepts the client into the session or sends back a denial payload and closes the
              connection.
            </p>
            <p>
              The authentication exchange happens before any game objects are spawned or state is
              replicated, so unauthenticated clients never see game data.
            </p>

            <h2>API reference</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={authResponseParamsEN} />
          </div>

          <div className="prose">
            <h2>Basic example — password-protected server</h2>
          </div>

          <CodeBlock
            filename="PasswordAuth.cs"
            language="csharp"
            code={`using PurrNet;
using UnityEngine;

// TPayload = what the client sends; TDenial = what the server sends back on failure
public class PasswordAuth : AuthenticationBehaviour<PasswordPayload, DenialReason>
{
    [SerializeField] private string _serverPassword = "supersecret";

    // Runs on the CLIENT — assemble the credentials
    public override PasswordPayload GetClientPayload()
    {
        return new PasswordPayload
        {
            // In production use a salted hash, never plaintext
            passwordHash = HashUtil.SHA256(PlayerPrefs.GetString("ServerPassword", "")),
            clientVersion = Application.version,
        };
    }

    // Runs on the SERVER — validate and return Accept or Deny
    public override AuthenticationResponse ValidateClientPayload(
        PlayerID conn, PasswordPayload payload)
    {
        string expectedHash = HashUtil.SHA256(_serverPassword);

        if (payload.clientVersion != Application.version)
            return AuthenticationResponse.Deny(DenialReason.VersionMismatch);

        if (payload.passwordHash != expectedHash)
            return AuthenticationResponse.Deny(DenialReason.WrongPassword);

        return AuthenticationResponse.Accept();
    }

    // Runs on the SERVER when an authenticated client leaves
    public override void UnAuthenticateClient(PlayerID conn)
    {
        Debug.Log($"Client {conn} disconnected — releasing auth record.");
        // Release any server-side session data for this connection
    }
}

[System.Serializable]
public struct PasswordPayload : IPackedAuto
{
    public string passwordHash;
    public string clientVersion;
}

public enum DenialReason
{
    WrongPassword,
    VersionMismatch,
    ServerFull,
    Banned,
}`}
          />

          <div className="prose">
            <h2>Listening for denial on the client</h2>
            <p>
              Subscribe to <code>networkManager.onAuthenticationDenied</code> to receive the denial
              reason and show the player an appropriate UI message.
            </p>
          </div>

          <CodeBlock
            filename="ConnectionUI.cs"
            language="csharp"
            code={`using PurrNet;
using UnityEngine;
using TMPro;

public class ConnectionUI : MonoBehaviour
{
    [SerializeField] private NetworkManager _networkManager;
    [SerializeField] private GameObject     _deniedPanel;
    [SerializeField] private TextMeshProUGUI _deniedMessage;

    private void OnEnable()
    {
        // Fired on the client when the server sends a Deny() response
        _networkManager.onAuthenticationDenied += HandleDenied;
    }

    private void OnDisable()
    {
        _networkManager.onAuthenticationDenied -= HandleDenied;
    }

    private void HandleDenied(object reason)
    {
        _deniedPanel.SetActive(true);

        _deniedMessage.text = reason switch
        {
            DenialReason.WrongPassword    => "Incorrect server password.",
            DenialReason.VersionMismatch  => "Game version mismatch. Please update.",
            DenialReason.ServerFull       => "Server is full.",
            DenialReason.Banned           => "You have been banned from this server.",
            _                             => "Connection denied.",
        };
    }
}`}
          />

          <div className="prose">
            <h2>Situational example — JWT token authentication</h2>
            <p>
              For online games with an account backend, the client fetches a short-lived JWT from
              your auth service before connecting. The server verifies the signature without
              contacting the auth service on every connection, making validation fast and stateless.
            </p>
          </div>

          <CodeBlock
            filename="JwtAuth.cs"
            language="csharp"
            code={`using PurrNet;
using UnityEngine;

public class JwtAuth : AuthenticationBehaviour<JwtPayload, string>
{
    // Populated by your login flow before the player connects
    public static string cachedToken;

    public override JwtPayload GetClientPayload()
    {
        return new JwtPayload { jwtToken = cachedToken ?? string.Empty };
    }

    public override AuthenticationResponse ValidateClientPayload(
        PlayerID conn, JwtPayload payload)
    {
        if (string.IsNullOrEmpty(payload.jwtToken))
            return AuthenticationResponse.Deny("No token provided.");

        // JwtValidator uses your public key to verify the signature locally
        if (!JwtValidator.TryValidate(payload.jwtToken, out string userId))
            return AuthenticationResponse.Deny("Invalid or expired token.");

        // Store userId for this connection — available in game systems
        AuthRegistry.Register(conn, userId);
        return AuthenticationResponse.Accept();
    }

    public override void UnAuthenticateClient(PlayerID conn)
    {
        AuthRegistry.Remove(conn);
    }
}

[System.Serializable]
public struct JwtPayload : IPackedAuto
{
    public string jwtToken;
}`}
          />

          <Callout type="danger" title="Never send plain-text passwords">
            Always hash passwords client-side before transmitting them. Even over an encrypted
            transport, plain passwords can be extracted from memory or log files. Use a one-way
            hash (SHA-256 with a salt at minimum) or, better, a proper token-based scheme like JWT.
          </Callout>

          <Callout type="tip" title="Short-lived tokens reduce risk">
            For account-based games, issue a short-lived session token (10–60 minutes) from your
            auth backend after login. The client uses that token as the payload. If a token is
            stolen, it expires quickly, limiting the blast radius.
          </Callout>

          <Callout type="info" title="Authentication fires before spawn">
            The authentication exchange completes before <code>OnSpawned</code> fires on any game
            object. This means unauthenticated clients never receive scene state, player positions,
            or SyncVar values — not even partially.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="Authentication"
          description="ระบบ authentication ของ PurrNet ตรวจสอบแต่ละ client ที่เชื่อมต่อก่อนที่จะได้รับอนุญาตให้เข้าร่วมเกม Subclass AuthenticationBehaviour เพื่อ supply credentials จาก client และตรวจสอบบน server"
          badge="Advanced"
          href="/docs/authentication"
        >
          <div className="not-prose mb-6">
            <AuthFlowVisualizer />
          </div>

          <div className="prose">
            <h2>วิธีการทำงาน</h2>
            <p>
              เมื่อ client เชื่อมต่อ PurrNet เรียก <code>GetClientPayload()</code> บน client side
              payload ที่คืนมา (serializable type ใดก็ตาม) จะถูกส่งไปยัง server ซึ่ง{" "}
              <code>ValidateClientPayload()</code> ทำงาน ตามผลลัพธ์ server จะ accept client เข้าสู่
              session หรือส่ง denial payload กลับและปิด connection
            </p>
            <p>
              การแลกเปลี่ยน authentication เกิดขึ้นก่อนที่ game objects ใดๆ จะถูก spawn หรือ state
              ถูก replicate ดังนั้น unauthenticated clients จะไม่เห็นข้อมูลเกม
            </p>

            <h2>API reference</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={authResponseParamsTH} />
          </div>

          <div className="prose">
            <h2>ตัวอย่างพื้นฐาน — server ที่ป้องกันด้วย password</h2>
          </div>

          <CodeBlock
            filename="PasswordAuth.cs"
            language="csharp"
            code={`using PurrNet;
using UnityEngine;

// TPayload = what the client sends; TDenial = what the server sends back on failure
public class PasswordAuth : AuthenticationBehaviour<PasswordPayload, DenialReason>
{
    [SerializeField] private string _serverPassword = "supersecret";

    // Runs on the CLIENT — assemble the credentials
    public override PasswordPayload GetClientPayload()
    {
        return new PasswordPayload
        {
            // In production use a salted hash, never plaintext
            passwordHash = HashUtil.SHA256(PlayerPrefs.GetString("ServerPassword", "")),
            clientVersion = Application.version,
        };
    }

    // Runs on the SERVER — validate and return Accept or Deny
    public override AuthenticationResponse ValidateClientPayload(
        PlayerID conn, PasswordPayload payload)
    {
        string expectedHash = HashUtil.SHA256(_serverPassword);

        if (payload.clientVersion != Application.version)
            return AuthenticationResponse.Deny(DenialReason.VersionMismatch);

        if (payload.passwordHash != expectedHash)
            return AuthenticationResponse.Deny(DenialReason.WrongPassword);

        return AuthenticationResponse.Accept();
    }

    // Runs on the SERVER when an authenticated client leaves
    public override void UnAuthenticateClient(PlayerID conn)
    {
        Debug.Log($"Client {conn} disconnected — releasing auth record.");
        // Release any server-side session data for this connection
    }
}

[System.Serializable]
public struct PasswordPayload : IPackedAuto
{
    public string passwordHash;
    public string clientVersion;
}

public enum DenialReason
{
    WrongPassword,
    VersionMismatch,
    ServerFull,
    Banned,
}`}
          />

          <div className="prose">
            <h2>การรับฟัง denial บน client</h2>
            <p>
              Subscribe กับ <code>networkManager.onAuthenticationDenied</code> เพื่อรับ denial
              reason และแสดง UI message ที่เหมาะสมให้ผู้เล่น
            </p>
          </div>

          <CodeBlock
            filename="ConnectionUI.cs"
            language="csharp"
            code={`using PurrNet;
using UnityEngine;
using TMPro;

public class ConnectionUI : MonoBehaviour
{
    [SerializeField] private NetworkManager _networkManager;
    [SerializeField] private GameObject     _deniedPanel;
    [SerializeField] private TextMeshProUGUI _deniedMessage;

    private void OnEnable()
    {
        // Fired on the client when the server sends a Deny() response
        _networkManager.onAuthenticationDenied += HandleDenied;
    }

    private void OnDisable()
    {
        _networkManager.onAuthenticationDenied -= HandleDenied;
    }

    private void HandleDenied(object reason)
    {
        _deniedPanel.SetActive(true);

        _deniedMessage.text = reason switch
        {
            DenialReason.WrongPassword    => "Incorrect server password.",
            DenialReason.VersionMismatch  => "Game version mismatch. Please update.",
            DenialReason.ServerFull       => "Server is full.",
            DenialReason.Banned           => "You have been banned from this server.",
            _                             => "Connection denied.",
        };
    }
}`}
          />

          <div className="prose">
            <h2>ตัวอย่างสถานการณ์ — JWT token authentication</h2>
            <p>
              สำหรับเกม online ที่มี account backend client จะดึง short-lived JWT จาก auth service
              ของคุณก่อนเชื่อมต่อ Server ตรวจสอบ signature โดยไม่ต้องติดต่อ auth service ในทุก
              connection ทำให้การตรวจสอบเร็วและ stateless
            </p>
          </div>

          <CodeBlock
            filename="JwtAuth.cs"
            language="csharp"
            code={`using PurrNet;
using UnityEngine;

public class JwtAuth : AuthenticationBehaviour<JwtPayload, string>
{
    // Populated by your login flow before the player connects
    public static string cachedToken;

    public override JwtPayload GetClientPayload()
    {
        return new JwtPayload { jwtToken = cachedToken ?? string.Empty };
    }

    public override AuthenticationResponse ValidateClientPayload(
        PlayerID conn, JwtPayload payload)
    {
        if (string.IsNullOrEmpty(payload.jwtToken))
            return AuthenticationResponse.Deny("No token provided.");

        // JwtValidator uses your public key to verify the signature locally
        if (!JwtValidator.TryValidate(payload.jwtToken, out string userId))
            return AuthenticationResponse.Deny("Invalid or expired token.");

        // Store userId for this connection — available in game systems
        AuthRegistry.Register(conn, userId);
        return AuthenticationResponse.Accept();
    }

    public override void UnAuthenticateClient(PlayerID conn)
    {
        AuthRegistry.Remove(conn);
    }
}

[System.Serializable]
public struct JwtPayload : IPackedAuto
{
    public string jwtToken;
}`}
          />

          <Callout type="danger" title="อย่าส่ง plain-text passwords">
            Hash passwords บน client-side เสมอก่อนส่ง แม้ผ่าน encrypted transport plain passwords
            สามารถถูกดึงออกจาก memory หรือ log files ใช้ one-way hash (SHA-256 พร้อม salt อย่างน้อย)
            หรือดีกว่านั้นใช้ token-based scheme ที่เหมาะสมเช่น JWT
          </Callout>

          <Callout type="tip" title="Short-lived tokens ลดความเสี่ยง">
            สำหรับเกมที่ใช้ account ออก short-lived session token (10–60 นาที) จาก auth backend ของคุณ
            หลังจาก login Client ใช้ token นั้นเป็น payload ถ้า token ถูกขโมย มันจะหมดอายุอย่างรวดเร็ว
            จำกัดความเสียหาย
          </Callout>

          <Callout type="info" title="Authentication fire ก่อน spawn">
            การแลกเปลี่ยน authentication เสร็จสิ้นก่อนที่ <code>OnSpawned</code> จะ fire บน game object ใดก็ตาม
            หมายความว่า unauthenticated clients จะไม่ได้รับ scene state, player positions หรือ SyncVar
            values — ไม่แม้แต่บางส่วน
          </Callout>
        </DocPage>
      }
    />
  );
}
