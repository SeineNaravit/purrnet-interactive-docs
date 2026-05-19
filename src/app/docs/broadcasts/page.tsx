import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { BroadcastVisualizer } from "@/components/visualizers/BroadcastVisualizer";

export const metadata = { title: "Broadcasts" };

const apiParamsEN = [
  { name: "BroadcastAll<T>(T data)", type: "void", description: "Sends the data packet to every connected client. Called from the server." },
  { name: "BroadcastConnection<T>(NetworkConnection conn, T data)", type: "void", description: "Sends the data packet to a single specific connection. Useful for private messages or targeted state." },
  { name: "BroadcastServer<T>(T data)", type: "void", description: "Sends the data packet from a client up to the server. The server receives it via its registered handler." },
  { name: "Subscribe<T>(Action<T, NetworkConnection> handler)", type: "void", description: "Registers a handler for broadcast packets of type T. The second parameter is the sender's connection (available on the server)." },
  { name: "Unsubscribe<T>(Action<T, NetworkConnection> handler)", type: "void", description: "Removes a previously registered handler. Always unsubscribe when done to prevent memory leaks." },
];

const apiParamsTH = [
  { name: "BroadcastAll<T>(T data)", type: "void", description: "ส่ง data packet ไปยัง clients ที่เชื่อมต่อทุกคน เรียกจาก server" },
  { name: "BroadcastConnection<T>(NetworkConnection conn, T data)", type: "void", description: "ส่ง data packet ไปยัง connection เฉพาะเพียงตัวเดียว ใช้สำหรับ private messages หรือ targeted state" },
  { name: "BroadcastServer<T>(T data)", type: "void", description: "ส่ง data packet จาก client ขึ้นไปยัง server Server รับผ่าน registered handler ของตัวเอง" },
  { name: "Subscribe<T>(Action<T, NetworkConnection> handler)", type: "void", description: "ลงทะเบียน handler สำหรับ broadcast packets ประเภท T พารามิเตอร์ที่สองคือ connection ของผู้ส่ง (มีให้บน server)" },
  { name: "Unsubscribe<T>(Action<T, NetworkConnection> handler)", type: "void", description: "ลบ handler ที่ลงทะเบียนไว้ก่อนหน้า Unsubscribe เสมอเมื่อเสร็จสิ้นเพื่อป้องกัน memory leaks" },
];

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="Broadcasts"
          description="Broadcasts send arbitrary data packets over a connection without requiring a NetworkIdentity. They are ideal for lobby data, global chat, and any messages that exist before or outside of spawned objects."
          badge="Advanced"
          href="/docs/broadcasts"
        >
          <div className="not-prose mb-6">
            <BroadcastVisualizer />
          </div>

          <div className="prose">
            <h2>What makes broadcasts different</h2>
            <p>
              Every RPC in PurrNet is dispatched through a <code>NetworkIdentity</code> — the packet
              addresses a specific object on the network. Broadcasts are <em>connection-scoped</em>:
              they are addressed to a connection or to all connections, with no object in the middle.
            </p>
            <p>This makes broadcasts the right tool when:</p>
            <ul>
              <li>You need to communicate before any objects are spawned (lobby, authentication handshake)</li>
              <li>The message is truly global and not owned by any game object (global chat, server announcements)</li>
              <li>You are implementing a system that manages objects and should not itself be an object (a matchmaking service)</li>
            </ul>

            <h2>API reference</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={apiParamsEN} />
          </div>

          <div className="prose">
            <h2>Registering broadcast types</h2>
            <p>
              Any struct decorated with <code>[System.Serializable]</code> and implementing{" "}
              <code>IPackedAuto</code> (or a registered custom serializer) can be used as a broadcast
              payload. No additional registration is needed beyond what PurrNet requires for any
              serializable type.
            </p>

            <h2>Basic usage — server to all clients</h2>
          </div>

          <CodeBlock
            filename="ServerAnnouncement.cs"
            language="csharp"
            code={`using PurrNet;
using UnityEngine;

[System.Serializable]
public struct ServerAnnouncementMsg : IPackedAuto
{
    public string text;
    public float  displayDuration;
}

public class AnnouncementSystem : MonoBehaviour
{
    private NetworkManager _nm;

    private void Awake()
    {
        _nm = GetComponent<NetworkManager>();
    }

    private void OnEnable()
    {
        // Subscribe on all machines
        _nm.Subscribe<ServerAnnouncementMsg>(OnAnnouncementReceived);
    }

    private void OnDisable()
    {
        _nm.Unsubscribe<ServerAnnouncementMsg>(OnAnnouncementReceived);
    }

    // Server calls this to push an announcement to everyone
    public void SendGlobalAnnouncement(string text, float duration = 5f)
    {
        if (!_nm.isServer) return;

        _nm.BroadcastAll(new ServerAnnouncementMsg
        {
            text            = text,
            displayDuration = duration,
        });
    }

    private void OnAnnouncementReceived(ServerAnnouncementMsg msg, NetworkConnection sender)
    {
        // Runs on every client when the server broadcasts
        AnnouncerUI.Show(msg.text, msg.displayDuration);
    }
}`}
          />

          <div className="prose">
            <h2>Client → server broadcasts</h2>
            <p>
              Clients can also send data up to the server using <code>BroadcastServer&lt;T&gt;</code>.
              This is the broadcast equivalent of a <code>[ServerRpc]</code> — useful before any
              objects exist that could host an RPC.
            </p>
          </div>

          <CodeBlock
            filename="LobbyChat.cs"
            language="csharp"
            code={`using PurrNet;
using UnityEngine;

[System.Serializable]
public struct ChatMessage : IPackedAuto
{
    public string senderName;
    public string text;
    public float  timestamp;
}

public class LobbyChat : MonoBehaviour
{
    private NetworkManager _nm;

    private void Awake()
    {
        _nm = GetComponent<NetworkManager>();
    }

    private void OnEnable()
    {
        // Server listens for incoming chat messages from clients
        if (_nm.isServer)
            _nm.Subscribe<ChatMessage>(OnChatMessageFromClient);

        // All machines (including server) listen for the relayed broadcast
        _nm.Subscribe<ChatMessage>(OnChatMessageBroadcast);
    }

    private void OnDisable()
    {
        if (_nm.isServer)
            _nm.Unsubscribe<ChatMessage>(OnChatMessageFromClient);

        _nm.Unsubscribe<ChatMessage>(OnChatMessageBroadcast);
    }

    // Called by the local player when they press Send
    public void SendChatMessage(string text)
    {
        // No NetworkIdentity needed — just broadcast to the server
        _nm.BroadcastServer(new ChatMessage
        {
            senderName = PlayerPrefs.GetString("PlayerName", "Unknown"),
            text       = text,
            timestamp  = Time.time,
        });
    }

    // Server receives the client's chat and relays to all clients
    private void OnChatMessageFromClient(ChatMessage msg, NetworkConnection sender)
    {
        if (!_nm.isServer) return;

        // Optionally validate/moderate msg.text here
        _nm.BroadcastAll(msg); // relay to everyone
    }

    // Every client (and the server) displays the relayed message
    private void OnChatMessageBroadcast(ChatMessage msg, NetworkConnection sender)
    {
        LobbyChatUI.AddMessage(msg.senderName, msg.text);
    }
}`}
          />

          <div className="prose">
            <h2>Situational example — pre-spawn matchmaking data</h2>
            <p>
              This example shows how a client can send matchmaking preferences to the server before
              any game objects are spawned, and how the server can reply with the assigned team —
              all via broadcasts.
            </p>
          </div>

          <CodeBlock
            filename="MatchmakingBroadcasts.cs"
            language="csharp"
            code={`using PurrNet;
using UnityEngine;

[System.Serializable]
public struct MatchmakingRequest : IPackedAuto
{
    public int    preferredTeam; // 0 = any, 1 = red, 2 = blue
    public string selectedSkin;
}

[System.Serializable]
public struct MatchmakingResponse : IPackedAuto
{
    public int    assignedTeam;
    public int    spawnPointIndex;
    public bool   accepted;
}

public class MatchmakingHandler : MonoBehaviour
{
    private NetworkManager _nm;

    private void Awake()
    {
        _nm = GetComponent<NetworkManager>();
    }

    private void OnEnable()
    {
        if (_nm.isServer)
            _nm.Subscribe<MatchmakingRequest>(OnClientRequest);
        else
            _nm.Subscribe<MatchmakingResponse>(OnServerResponse);
    }

    private void OnDisable()
    {
        if (_nm.isServer)
            _nm.Unsubscribe<MatchmakingRequest>(OnClientRequest);
        else
            _nm.Unsubscribe<MatchmakingResponse>(OnServerResponse);
    }

    // Client sends preferences when it connects
    public void RequestMatch(int preferredTeam, string skin)
    {
        _nm.BroadcastServer(new MatchmakingRequest
        {
            preferredTeam = preferredTeam,
            selectedSkin  = skin,
        });
    }

    // Server assigns and responds to the specific client
    private void OnClientRequest(MatchmakingRequest req, NetworkConnection sender)
    {
        int team  = TeamBalancer.AssignTeam(req.preferredTeam);
        int spawn = SpawnManager.ReservePoint(team);

        _nm.BroadcastConnection(sender, new MatchmakingResponse
        {
            assignedTeam    = team,
            spawnPointIndex = spawn,
            accepted        = true,
        });
    }

    // Client receives its assignment and prepares to spawn
    private void OnServerResponse(MatchmakingResponse resp, NetworkConnection sender)
    {
        if (!resp.accepted)
        {
            LobbyUI.ShowRejected();
            return;
        }

        PlayerPrefs.SetInt("AssignedTeam",  resp.assignedTeam);
        PlayerPrefs.SetInt("SpawnIndex",    resp.spawnPointIndex);
        LobbyUI.ShowReady(resp.assignedTeam);
    }
}`}
          />

          <Callout type="tip" title="Use broadcasts for lobby and pre-spawn data">
            Spawned <code>NetworkBehaviour</code> objects are only available after the server creates
            them. Anything that must happen before spawning — team selection, loadout choice,
            authentication tokens — belongs in a broadcast, not an RPC. Move to RPCs once objects
            exist.
          </Callout>

          <Callout type="warning" title="Broadcasts are not filtered by visibility">
            Unlike RPCs that respect the Network Visibility system, <code>BroadcastAll</code> sends
            to every connected client regardless of whether they should be observing a particular
            object. Apply your own application-level filtering (e.g. only relay chat to players in
            the same lobby) before calling <code>BroadcastAll</code> or route to specific connections
            with <code>BroadcastConnection</code>.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="Broadcasts"
          description="Broadcasts ส่ง arbitrary data packets ผ่าน connection โดยไม่ต้องการ NetworkIdentity เหมาะสำหรับ lobby data, global chat และ messages ใดๆ ที่มีอยู่ก่อนหรือภายนอก spawned objects"
          badge="Advanced"
          href="/docs/broadcasts"
        >
          <div className="not-prose mb-6">
            <BroadcastVisualizer />
          </div>

          <div className="prose">
            <h2>อะไรทำให้ broadcasts แตกต่าง</h2>
            <p>
              RPC ทุกตัวใน PurrNet ถูก dispatch ผ่าน <code>NetworkIdentity</code> — packet
              ระบุ object เฉพาะบนเครือข่าย Broadcasts เป็นแบบ <em>connection-scoped</em>: ถูกระบุ
              ไปยัง connection หรือ connections ทั้งหมดโดยไม่มี object อยู่ตรงกลาง
            </p>
            <p>ทำให้ broadcasts เป็นเครื่องมือที่เหมาะสมเมื่อ:</p>
            <ul>
              <li>คุณต้องการสื่อสารก่อนที่ objects ใดๆ จะถูก spawn (lobby, authentication handshake)</li>
              <li>Message เป็น global จริงๆ และไม่ได้เป็นเจ้าของโดย game object ใด (global chat, server announcements)</li>
              <li>คุณกำลัง implement ระบบที่จัดการ objects และไม่ควรเป็น object เอง (matchmaking service)</li>
            </ul>

            <h2>API reference</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={apiParamsTH} />
          </div>

          <div className="prose">
            <h2>การลงทะเบียน broadcast types</h2>
            <p>
              struct ใดก็ตามที่ตกแต่งด้วย <code>[System.Serializable]</code> และ implement{" "}
              <code>IPackedAuto</code> (หรือ registered custom serializer) สามารถใช้เป็น broadcast
              payload ได้ ไม่ต้องการการลงทะเบียนเพิ่มเติมนอกจากสิ่งที่ PurrNet ต้องการสำหรับ
              serializable type ใดก็ตาม
            </p>

            <h2>การใช้พื้นฐาน — server ไปยัง clients ทั้งหมด</h2>
          </div>

          <CodeBlock
            filename="ServerAnnouncement.cs"
            language="csharp"
            code={`using PurrNet;
using UnityEngine;

[System.Serializable]
public struct ServerAnnouncementMsg : IPackedAuto
{
    public string text;
    public float  displayDuration;
}

public class AnnouncementSystem : MonoBehaviour
{
    private NetworkManager _nm;

    private void Awake()
    {
        _nm = GetComponent<NetworkManager>();
    }

    private void OnEnable()
    {
        // Subscribe on all machines
        _nm.Subscribe<ServerAnnouncementMsg>(OnAnnouncementReceived);
    }

    private void OnDisable()
    {
        _nm.Unsubscribe<ServerAnnouncementMsg>(OnAnnouncementReceived);
    }

    // Server calls this to push an announcement to everyone
    public void SendGlobalAnnouncement(string text, float duration = 5f)
    {
        if (!_nm.isServer) return;

        _nm.BroadcastAll(new ServerAnnouncementMsg
        {
            text            = text,
            displayDuration = duration,
        });
    }

    private void OnAnnouncementReceived(ServerAnnouncementMsg msg, NetworkConnection sender)
    {
        // Runs on every client when the server broadcasts
        AnnouncerUI.Show(msg.text, msg.displayDuration);
    }
}`}
          />

          <div className="prose">
            <h2>Broadcasts จาก client ไปยัง server</h2>
            <p>
              Clients ยังสามารถส่งข้อมูลขึ้นไปยัง server โดยใช้ <code>BroadcastServer&lt;T&gt;</code>
              นี่คือ broadcast equivalent ของ <code>[ServerRpc]</code> — มีประโยชน์ก่อนที่ objects
              ใดๆ จะมีอยู่ที่สามารถ host RPC ได้
            </p>
          </div>

          <CodeBlock
            filename="LobbyChat.cs"
            language="csharp"
            code={`using PurrNet;
using UnityEngine;

[System.Serializable]
public struct ChatMessage : IPackedAuto
{
    public string senderName;
    public string text;
    public float  timestamp;
}

public class LobbyChat : MonoBehaviour
{
    private NetworkManager _nm;

    private void Awake()
    {
        _nm = GetComponent<NetworkManager>();
    }

    private void OnEnable()
    {
        // Server listens for incoming chat messages from clients
        if (_nm.isServer)
            _nm.Subscribe<ChatMessage>(OnChatMessageFromClient);

        // All machines (including server) listen for the relayed broadcast
        _nm.Subscribe<ChatMessage>(OnChatMessageBroadcast);
    }

    private void OnDisable()
    {
        if (_nm.isServer)
            _nm.Unsubscribe<ChatMessage>(OnChatMessageFromClient);

        _nm.Unsubscribe<ChatMessage>(OnChatMessageBroadcast);
    }

    // Called by the local player when they press Send
    public void SendChatMessage(string text)
    {
        // No NetworkIdentity needed — just broadcast to the server
        _nm.BroadcastServer(new ChatMessage
        {
            senderName = PlayerPrefs.GetString("PlayerName", "Unknown"),
            text       = text,
            timestamp  = Time.time,
        });
    }

    // Server receives the client's chat and relays to all clients
    private void OnChatMessageFromClient(ChatMessage msg, NetworkConnection sender)
    {
        if (!_nm.isServer) return;

        // Optionally validate/moderate msg.text here
        _nm.BroadcastAll(msg); // relay to everyone
    }

    // Every client (and the server) displays the relayed message
    private void OnChatMessageBroadcast(ChatMessage msg, NetworkConnection sender)
    {
        LobbyChatUI.AddMessage(msg.senderName, msg.text);
    }
}`}
          />

          <div className="prose">
            <h2>ตัวอย่างสถานการณ์ — ข้อมูล matchmaking ก่อน spawn</h2>
            <p>
              ตัวอย่างนี้แสดงวิธีที่ client สามารถส่ง matchmaking preferences ไปยัง server ก่อนที่
              game objects ใดๆ จะถูก spawn และวิธีที่ server สามารถตอบกลับด้วย assigned team —
              ทั้งหมดผ่าน broadcasts
            </p>
          </div>

          <CodeBlock
            filename="MatchmakingBroadcasts.cs"
            language="csharp"
            code={`using PurrNet;
using UnityEngine;

[System.Serializable]
public struct MatchmakingRequest : IPackedAuto
{
    public int    preferredTeam; // 0 = any, 1 = red, 2 = blue
    public string selectedSkin;
}

[System.Serializable]
public struct MatchmakingResponse : IPackedAuto
{
    public int    assignedTeam;
    public int    spawnPointIndex;
    public bool   accepted;
}

public class MatchmakingHandler : MonoBehaviour
{
    private NetworkManager _nm;

    private void Awake()
    {
        _nm = GetComponent<NetworkManager>();
    }

    private void OnEnable()
    {
        if (_nm.isServer)
            _nm.Subscribe<MatchmakingRequest>(OnClientRequest);
        else
            _nm.Subscribe<MatchmakingResponse>(OnServerResponse);
    }

    private void OnDisable()
    {
        if (_nm.isServer)
            _nm.Unsubscribe<MatchmakingRequest>(OnClientRequest);
        else
            _nm.Unsubscribe<MatchmakingResponse>(OnServerResponse);
    }

    // Client sends preferences when it connects
    public void RequestMatch(int preferredTeam, string skin)
    {
        _nm.BroadcastServer(new MatchmakingRequest
        {
            preferredTeam = preferredTeam,
            selectedSkin  = skin,
        });
    }

    // Server assigns and responds to the specific client
    private void OnClientRequest(MatchmakingRequest req, NetworkConnection sender)
    {
        int team  = TeamBalancer.AssignTeam(req.preferredTeam);
        int spawn = SpawnManager.ReservePoint(team);

        _nm.BroadcastConnection(sender, new MatchmakingResponse
        {
            assignedTeam    = team,
            spawnPointIndex = spawn,
            accepted        = true,
        });
    }

    // Client receives its assignment and prepares to spawn
    private void OnServerResponse(MatchmakingResponse resp, NetworkConnection sender)
    {
        if (!resp.accepted)
        {
            LobbyUI.ShowRejected();
            return;
        }

        PlayerPrefs.SetInt("AssignedTeam",  resp.assignedTeam);
        PlayerPrefs.SetInt("SpawnIndex",    resp.spawnPointIndex);
        LobbyUI.ShowReady(resp.assignedTeam);
    }
}`}
          />

          <Callout type="tip" title="ใช้ broadcasts สำหรับ lobby และข้อมูลก่อน spawn">
            Objects <code>NetworkBehaviour</code> ที่ spawn มีให้ใช้เฉพาะหลังจาก server สร้างพวกมัน
            สิ่งใดก็ตามที่ต้องเกิดขึ้นก่อน spawning — team selection, loadout choice, authentication
            tokens — ควรอยู่ใน broadcast ไม่ใช่ RPC ย้ายไปยัง RPCs เมื่อ objects มีอยู่แล้ว
          </Callout>

          <Callout type="warning" title="Broadcasts ไม่ถูก filter โดย visibility">
            ต่างจาก RPCs ที่เคารพ Network Visibility system <code>BroadcastAll</code> ส่งไปยัง
            clients ที่เชื่อมต่อทุกคนโดยไม่คำนึงว่าพวกเขาควร observe object เฉพาะหรือไม่
            ใช้ application-level filtering ของคุณเอง (เช่น relay chat เฉพาะไปยังผู้เล่นใน lobby เดียวกัน)
            ก่อนเรียก <code>BroadcastAll</code> หรือ route ไปยัง connections เฉพาะด้วย{" "}
            <code>BroadcastConnection</code>
          </Callout>
        </DocPage>
      }
    />
  );
}
