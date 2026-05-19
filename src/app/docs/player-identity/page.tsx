import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";

export const metadata = { title: "PlayerIdentity" };

const apiParamsEN = [
  {
    name: "Player.TryGetLocal(out T player)",
    type: "bool",
    description: "Returns the local player instance if one has been spawned for the calling client. Returns false on the server or before spawn.",
  },
  {
    name: "Player.TryGetPlayer(PlayerID id, out T player)",
    type: "bool",
    description: "Looks up a player by their PlayerID. Useful for targeting a specific connected client.",
  },
  {
    name: "Player.allPlayers",
    type: "IReadOnlyList<T>",
    description: "A read-only list of every currently spawned player instance. Iterated in join order. Updated automatically on connect/disconnect.",
  },
  {
    name: "localPlayer",
    type: "T?",
    description: "Static convenience accessor — returns the local player or null. Equivalent to calling TryGetLocal.",
  },
  {
    name: "playerID",
    type: "PlayerID",
    description: "The network identity of the connection that owns this player object. Available after OnSpawned.",
  },
  {
    name: "isLocalPlayer",
    type: "bool",
    description: "True if this instance belongs to the local client. Equivalent to isOwner for player objects.",
  },
];

const apiParamsTH = [
  {
    name: "Player.TryGetLocal(out T player)",
    type: "bool",
    description: "คืน local player instance ถ้ามีการ spawn สำหรับ calling client คืน false บน server หรือก่อน spawn",
  },
  {
    name: "Player.TryGetPlayer(PlayerID id, out T player)",
    type: "bool",
    description: "ค้นหา player ตาม PlayerID มีประโยชน์สำหรับการ target connected client เฉพาะ",
  },
  {
    name: "Player.allPlayers",
    type: "IReadOnlyList<T>",
    description: "read-only list ของทุก player instance ที่ spawn อยู่ในขณะนี้ เรียงตามลำดับการเข้าร่วม อัปเดตโดยอัตโนมัติเมื่อ connect/disconnect",
  },
  {
    name: "localPlayer",
    type: "T?",
    description: "Static convenience accessor — คืน local player หรือ null เทียบเท่ากับการเรียก TryGetLocal",
  },
  {
    name: "playerID",
    type: "PlayerID",
    description: "Network identity ของ connection ที่เป็นเจ้าของ player object นี้ มีให้หลังจาก OnSpawned",
  },
  {
    name: "isLocalPlayer",
    type: "bool",
    description: "True ถ้า instance นี้属于 local client เทียบเท่ากับ isOwner สำหรับ player objects",
  },
];

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="PlayerIdentity"
          description="PlayerIdentity&lt;T&gt; is a typed base class for player prefabs that auto-registers each instance in a global static registry. Iterate all players, look up any player by ID, or grab the local player — all without a custom manager."
          badge="Advanced"
          href="/docs/player-identity"
        >
          <div className="prose">
            <h2>Overview</h2>
            <p>
              Subclass <code>PlayerIdentity&lt;T&gt;</code> where <code>T</code> is your own player
              class. When the server spawns a player prefab (typically via{" "}
              <code>NetworkManager.SpawnPlayer()</code>), the instance is automatically added to the
              static <code>Player.allPlayers</code> list. When the player disconnects and the object
              is despawned, it is removed automatically.
            </p>
            <p>
              Because the registry is generic and typed, <code>Player.allPlayers</code> returns your
              exact subclass — no casting, no null-checks.
            </p>

            <h2>API reference</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={apiParamsEN} />
          </div>

          <div className="prose">
            <h2>Defining your player class</h2>
          </div>

          <CodeBlock
            filename="Player.cs"
            language="csharp"
            code={`using PurrNet;
using UnityEngine;

// The generic parameter is your own class — enables the typed static registry
public class Player : PlayerIdentity<Player>
{
    private SyncVar<string> _displayName = new("Player", ownerAuth: true);
    private SyncVar<int>    _kills       = new(0);
    private SyncVar<int>    _deaths      = new(0);

    public string displayName => _displayName.value;
    public int    kills       => _kills.value;
    public int    deaths      => _deaths.value;

    protected override void OnSpawned()
    {
        // isLocalPlayer == isOwner for player objects
        if (isLocalPlayer)
        {
            _displayName.value = PlayerPrefs.GetString("PlayerName", "Unknown");
        }

        // Broadcast the new joiner to all clients
        if (isServer) RpcAnnounceJoin(_displayName.value);
    }

    [ObserversRpc(runLocally: true)]
    private void RpcAnnounceJoin(string name)
    {
        ChatSystem.PostSystemMessage($"{name} joined the game.");
    }

    // Called by server-side damage systems
    public void Kill()
    {
        if (!isServer) return;
        _deaths.value++;
        RpcOnKilled();
    }

    public void AddKill()
    {
        if (!isServer) return;
        _kills.value++;
    }

    [ObserversRpc(runLocally: true)]
    private void RpcOnKilled()
    {
        // Play death VFX locally on every client
        DeathEffect.Play(transform.position);
    }
}`}
          />

          <div className="prose">
            <h2>Getting the local player</h2>
            <p>
              From any script, retrieve the local player without a manager singleton:
            </p>
          </div>

          <CodeBlock
            filename="HUDController.cs"
            language="csharp"
            code={`using PurrNet;
using UnityEngine;

public class HUDController : MonoBehaviour
{
    private void Start()
    {
        // Option A: static accessor (returns null if not yet spawned)
        if (Player.localPlayer is { } me)
        {
            me._displayName.onChanged += name => nameLabel.text = name;
        }
    }

    private void Update()
    {
        // Option B: TryGetLocal for a safe null-check pattern
        if (Player.TryGetLocal(out Player me))
        {
            killCountLabel.text = me.kills.ToString();
        }
    }
}`}
          />

          <div className="prose">
            <h2>Iterating all players — lobby roster</h2>
            <p>
              <code>Player.allPlayers</code> is available on every peer (server and clients). Use it
              to build a lobby list, a score table, or any system that needs to know about every
              connected player.
            </p>
          </div>

          <CodeBlock
            filename="LobbyUI.cs"
            language="csharp"
            code={`using PurrNet;
using UnityEngine;

public class LobbyUI : MonoBehaviour
{
    [SerializeField] private PlayerRowUI _rowPrefab;
    [SerializeField] private Transform   _listParent;

    private void OnEnable()
    {
        // Rebuild list whenever a player joins or leaves
        NetworkManager.onPlayerJoined  += _ => RebuildList();
        NetworkManager.onPlayerLeft    += _ => RebuildList();
        RebuildList();
    }

    private void OnDisable()
    {
        NetworkManager.onPlayerJoined  -= _ => RebuildList();
        NetworkManager.onPlayerLeft    -= _ => RebuildList();
    }

    private void RebuildList()
    {
        // Clear old rows
        foreach (Transform child in _listParent)
            Destroy(child.gameObject);

        // allPlayers is sorted by join order and already typed
        foreach (Player p in Player.allPlayers)
        {
            var row = Instantiate(_rowPrefab, _listParent);
            row.SetData(
                name:   p.displayName,
                kills:  p.kills,
                deaths: p.deaths,
                isYou:  p.isLocalPlayer
            );
        }
    }
}

// On the server — look up a specific player by connection ID
public class AntiCheatSystem : NetworkBehaviour
{
    [Server]
    public void KickPlayer(PlayerID targetId)
    {
        if (!Player.TryGetPlayer(targetId, out Player target)) return;
        networkManager.Kick(target.playerID, "Cheating detected");
    }
}`}
          />

          <Callout type="tip" title="Recommended pattern for player prefabs">
            Use <code>PlayerIdentity&lt;T&gt;</code> for your player prefab instead of a plain{" "}
            <code>NetworkBehaviour</code>. The auto-registry eliminates the boilerplate of maintaining
            a manual player list and ensures the list is always accurate even through host migration
            or mid-game joins.
          </Callout>

          <Callout type="info" title="PlayerIdentity and ownership">
            By default, PurrNet gives ownership of a spawned player object to the connection that
            triggered the spawn. <code>isOwner</code> and <code>isLocalPlayer</code> are synonymous
            on player objects. Only the server can change ownership via <code>GiveOwnership()</code>.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="PlayerIdentity"
          description="PlayerIdentity&lt;T&gt; คือ typed base class สำหรับ player prefabs ที่ auto-register แต่ละ instance ใน global static registry วนซ้ำ players ทั้งหมด, ค้นหา player ใดก็ตามตาม ID หรือดึง local player — ทั้งหมดโดยไม่ต้องมี custom manager"
          badge="Advanced"
          href="/docs/player-identity"
        >
          <div className="prose">
            <h2>ภาพรวม</h2>
            <p>
              Subclass <code>PlayerIdentity&lt;T&gt;</code> โดยที่ <code>T</code> คือ player class ของคุณเอง
              เมื่อ server spawn player prefab (โดยทั่วไปผ่าน <code>NetworkManager.SpawnPlayer()</code>),
              instance จะถูกเพิ่มไปยัง static list <code>Player.allPlayers</code> โดยอัตโนมัติ เมื่อ
              player disconnect และ object ถูก despawn จะถูกลบออกโดยอัตโนมัติ
            </p>
            <p>
              เนื่องจาก registry เป็น generic และมี type <code>Player.allPlayers</code> จึงคืน
              subclass ที่แน่นอนของคุณ — ไม่ต้อง casting ไม่ต้อง null-checks
            </p>

            <h2>API reference</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={apiParamsTH} />
          </div>

          <div className="prose">
            <h2>การกำหนด player class ของคุณ</h2>
          </div>

          <CodeBlock
            filename="Player.cs"
            language="csharp"
            code={`using PurrNet;
using UnityEngine;

// The generic parameter is your own class — enables the typed static registry
public class Player : PlayerIdentity<Player>
{
    private SyncVar<string> _displayName = new("Player", ownerAuth: true);
    private SyncVar<int>    _kills       = new(0);
    private SyncVar<int>    _deaths      = new(0);

    public string displayName => _displayName.value;
    public int    kills       => _kills.value;
    public int    deaths      => _deaths.value;

    protected override void OnSpawned()
    {
        // isLocalPlayer == isOwner for player objects
        if (isLocalPlayer)
        {
            _displayName.value = PlayerPrefs.GetString("PlayerName", "Unknown");
        }

        // Broadcast the new joiner to all clients
        if (isServer) RpcAnnounceJoin(_displayName.value);
    }

    [ObserversRpc(runLocally: true)]
    private void RpcAnnounceJoin(string name)
    {
        ChatSystem.PostSystemMessage($"{name} joined the game.");
    }

    // Called by server-side damage systems
    public void Kill()
    {
        if (!isServer) return;
        _deaths.value++;
        RpcOnKilled();
    }

    public void AddKill()
    {
        if (!isServer) return;
        _kills.value++;
    }

    [ObserversRpc(runLocally: true)]
    private void RpcOnKilled()
    {
        // Play death VFX locally on every client
        DeathEffect.Play(transform.position);
    }
}`}
          />

          <div className="prose">
            <h2>การดึง local player</h2>
            <p>
              จาก script ใดก็ตาม ดึง local player โดยไม่ต้องมี manager singleton:
            </p>
          </div>

          <CodeBlock
            filename="HUDController.cs"
            language="csharp"
            code={`using PurrNet;
using UnityEngine;

public class HUDController : MonoBehaviour
{
    private void Start()
    {
        // Option A: static accessor (returns null if not yet spawned)
        if (Player.localPlayer is { } me)
        {
            me._displayName.onChanged += name => nameLabel.text = name;
        }
    }

    private void Update()
    {
        // Option B: TryGetLocal for a safe null-check pattern
        if (Player.TryGetLocal(out Player me))
        {
            killCountLabel.text = me.kills.ToString();
        }
    }
}`}
          />

          <div className="prose">
            <h2>การวนซ้ำ players ทั้งหมด — lobby roster</h2>
            <p>
              <code>Player.allPlayers</code> มีให้ใช้บนทุก peer (server และ clients) ใช้มันสร้าง
              lobby list, score table หรือระบบใดก็ตามที่ต้องการทราบเกี่ยวกับทุก connected player
            </p>
          </div>

          <CodeBlock
            filename="LobbyUI.cs"
            language="csharp"
            code={`using PurrNet;
using UnityEngine;

public class LobbyUI : MonoBehaviour
{
    [SerializeField] private PlayerRowUI _rowPrefab;
    [SerializeField] private Transform   _listParent;

    private void OnEnable()
    {
        // Rebuild list whenever a player joins or leaves
        NetworkManager.onPlayerJoined  += _ => RebuildList();
        NetworkManager.onPlayerLeft    += _ => RebuildList();
        RebuildList();
    }

    private void OnDisable()
    {
        NetworkManager.onPlayerJoined  -= _ => RebuildList();
        NetworkManager.onPlayerLeft    -= _ => RebuildList();
    }

    private void RebuildList()
    {
        // Clear old rows
        foreach (Transform child in _listParent)
            Destroy(child.gameObject);

        // allPlayers is sorted by join order and already typed
        foreach (Player p in Player.allPlayers)
        {
            var row = Instantiate(_rowPrefab, _listParent);
            row.SetData(
                name:   p.displayName,
                kills:  p.kills,
                deaths: p.deaths,
                isYou:  p.isLocalPlayer
            );
        }
    }
}

// On the server — look up a specific player by connection ID
public class AntiCheatSystem : NetworkBehaviour
{
    [Server]
    public void KickPlayer(PlayerID targetId)
    {
        if (!Player.TryGetPlayer(targetId, out Player target)) return;
        networkManager.Kick(target.playerID, "Cheating detected");
    }
}`}
          />

          <Callout type="tip" title="รูปแบบที่แนะนำสำหรับ player prefabs">
            ใช้ <code>PlayerIdentity&lt;T&gt;</code> สำหรับ player prefab ของคุณแทน plain{" "}
            <code>NetworkBehaviour</code> auto-registry ขจัด boilerplate ของการดูแล player list
            ด้วยตนเองและรับประกันว่า list จะถูกต้องเสมอแม้ผ่าน host migration หรือการเข้าร่วมระหว่างเกม
          </Callout>

          <Callout type="info" title="PlayerIdentity และ ownership">
            โดยค่าเริ่มต้น PurrNet มอบ ownership ของ spawned player object ให้กับ connection ที่ trigger
            การ spawn <code>isOwner</code> และ <code>isLocalPlayer</code> มีความหมายเดียวกันบน player objects
            เฉพาะ server เท่านั้นที่สามารถเปลี่ยน ownership ผ่าน <code>GiveOwnership()</code>
          </Callout>
        </DocPage>
      }
    />
  );
}
