import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";

export const metadata = { title: "Transports" };

const transportTableEN = [
  {
    name: "UDP (KcpTransport)",
    type: "UDP / KCP",
    default: "Any",
    description:
      "Default transport. Fast, reliable-optional channels over raw UDP. Best for PC and mobile games with low latency requirements.",
  },
  {
    name: "WebSocket",
    type: "TCP / WS",
    default: "WebGL",
    description:
      "Required for WebGL builds. Also useful for browser-based tools, admin panels, and firewalled corporate networks that block UDP.",
  },
  {
    name: "Steam (Facepunch / Mirror)",
    type: "Steam P2P",
    default: "Steam",
    description:
      "Routes traffic through Valve's relay network. No port forwarding needed. Requires Steamworks SDK and a Steam app ID.",
  },
  {
    name: "EOS (Epic Online Services)",
    type: "EOS P2P",
    default: "Epic Games",
    description:
      "Routes through Epic's relay network. Works on PC, console, and mobile. Requires EOS SDK and free developer account.",
  },
  {
    name: "Composite",
    type: "Auto-select",
    default: "Mixed platforms",
    description:
      "Container that holds multiple transports. Automatically picks the best available one per platform at startup.",
  },
  {
    name: "Local (Loopback)",
    type: "In-process",
    default: "Editor testing",
    description:
      "Connects server and client in the same process with no real network. Zero-latency. Ideal for automated testing and quick iteration.",
  },
  {
    name: "Purr (Relay)",
    type: "UDP relay",
    default: "Development",
    description:
      "Free relay transport hosted by the PurrNet team. No setup required. Intended for development and small-scale testing — not production.",
  },
];

const transportTableTH = [
  {
    name: "UDP (KcpTransport)",
    type: "UDP / KCP",
    default: "Any",
    description:
      "Transport เริ่มต้น Fast, reliable-optional channels ผ่าน raw UDP เหมาะสำหรับเกม PC และ mobile ที่มีความต้องการ latency ต่ำ",
  },
  {
    name: "WebSocket",
    type: "TCP / WS",
    default: "WebGL",
    description:
      "จำเป็นสำหรับ WebGL builds มีประโยชน์สำหรับ browser-based tools, admin panels และ firewalled corporate networks ที่บล็อก UDP",
  },
  {
    name: "Steam (Facepunch / Mirror)",
    type: "Steam P2P",
    default: "Steam",
    description:
      "Route traffic ผ่าน relay network ของ Valve ไม่ต้อง port forwarding ต้องการ Steamworks SDK และ Steam app ID",
  },
  {
    name: "EOS (Epic Online Services)",
    type: "EOS P2P",
    default: "Epic Games",
    description:
      "Route ผ่าน relay network ของ Epic ทำงานบน PC, console และ mobile ต้องการ EOS SDK และ developer account ฟรี",
  },
  {
    name: "Composite",
    type: "Auto-select",
    default: "Mixed platforms",
    description:
      "Container ที่เก็บ transports หลายตัว เลือก transport ที่ดีที่สุดที่มีอยู่ต่อ platform โดยอัตโนมัติเมื่อ startup",
  },
  {
    name: "Local (Loopback)",
    type: "In-process",
    default: "Editor testing",
    description:
      "เชื่อมต่อ server และ client ในกระบวนการเดียวกันโดยไม่มี network จริง Zero-latency เหมาะสำหรับ automated testing และการทดสอบอย่างรวดเร็ว",
  },
  {
    name: "Purr (Relay)",
    type: "UDP relay",
    default: "Development",
    description:
      "Free relay transport ที่ host โดยทีม PurrNet ไม่ต้องตั้งค่า เหมาะสำหรับ development และการทดสอบขนาดเล็ก — ไม่ใช่ production",
  },
];

const compositeCode = `// CompositeTransport configuration — set up in the Inspector, not in code.
// Priority order (first available wins):
//   1. SteamTransport   — active if Steamworks is initialised
//   2. KcpTransport     — active on PC / mobile / console
//   3. WebSocketTransport — active on WebGL
//
// You don't need any code; just add the components and set the priority list
// on the CompositeTransport component in the Inspector.

// If you DO need runtime transport switching (e.g. fallback on connection failure):
using PurrNet;
using UnityEngine;

public class TransportSelector : MonoBehaviour
{
    [SerializeField] private NetworkManager     _networkManager;
    [SerializeField] private CompositeTransport _composite;

    public void ForceWebSocket()
    {
        // Override platform detection — useful for troubleshooting
        _composite.ForceTransport<WebSocketTransport>();
    }
}`;

const kcpCode = `// These are Inspector properties on the KcpTransport component.
// No code is required — configure them in the Unity Inspector.
//
// Port:               7777    — UDP port to listen on (server) / connect to (client)
// Max Connections:    100     — hard cap; clients above this are rejected
// NoDelay:            true    — disable Nagle's algorithm for lower latency
// Interval (ms):      10      — internal KCP tick interval; lower = lower latency, higher CPU
// FastResend:         2       — retransmit after N duplicate ACKs without waiting for timeout
// CongestionWindow:   false   — disable congestion window for game traffic patterns
//
// For a dedicated server you will also want:
//   - IPv4+IPv6 dual-stack: enable DualMode in the transport
//   - Headless mode: set Application.targetFrameRate = 60 in a server bootstrap script

// Runtime address override (e.g. from a matchmaker response):
using PurrNet;
using UnityEngine;

public class MatchmakerConnector : MonoBehaviour
{
    [SerializeField] private NetworkManager _networkManager;
    [SerializeField] private KcpTransport   _transport;

    public void ConnectToServer(string ip, ushort port)
    {
        _transport.port    = port;
        _transport.address = ip;
        _networkManager.StartClient();
    }
}`;

const purrRelayCode = `// No code needed for basic usage — just:
//   1. Add PurrTransport component to the NetworkManager GameObject
//   2. Call networkManager.StartHost() from your menu UI
//   3. Share the room code from the console with your test partner
//   4. They add the code in their client UI and call networkManager.StartClient()

// If you want to display the room code in UI:
using PurrNet;
using TMPro;
using UnityEngine;

public class PurrRelayUI : MonoBehaviour
{
    [SerializeField] private PurrTransport    _purrTransport;
    [SerializeField] private TextMeshProUGUI  _roomCodeLabel;

    private void OnEnable()
    {
        _purrTransport.onRoomCreated += code => _roomCodeLabel.text = $"Room: {code}";
    }

    private void OnDisable()
    {
        _purrTransport.onRoomCreated -= code => _roomCodeLabel.text = $"Room: {code}";
    }
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="Transports"
          description="PurrNet is transport-agnostic. Swap the underlying protocol by dragging a different Transport component onto your NetworkManager. CompositeTransport lets you bundle multiple transports and auto-select the best one per platform."
          badge="Advanced"
          href="/docs/transports"
        >
          <div className="prose">
            <h2>Available transports</h2>
            <p>
              Each transport is a component that lives on the same GameObject as your{" "}
              <code>NetworkManager</code>. PurrNet reads whichever transport component is active at
              startup. Add only one active transport at a time, or use{" "}
              <strong>CompositeTransport</strong> to bundle several.
            </p>
          </div>

          <div className="not-prose">
            <ParamTable params={transportTableEN} />
          </div>

          <div className="prose">
            <h2>CompositeTransport — multi-platform setup</h2>
            <p>
              <code>CompositeTransport</code> holds a priority-ordered list of child transports. At
              startup, it tests each in order and activates the first one that is available on the
              current platform. This lets you ship a single build that uses UDP on PC, WebSocket on
              WebGL, and Steam P2P on Steam Deck without any <code>#if</code> guards in your code.
            </p>
          </div>

          <CodeBlock
            filename="NetworkManagerSetup.cs"
            language="csharp"
            code={compositeCode}
          />

          <div className="prose">
            <h2>Configuring the KCP (UDP) transport</h2>
            <p>
              The default UDP transport exposes several Inspector fields. Common production settings:
            </p>
          </div>

          <CodeBlock
            filename="KcpTransportSettings.cs"
            language="csharp"
            code={kcpCode}
          />

          <div className="prose">
            <h2>Purr Relay — quick dev testing</h2>
            <p>
              The Purr Transport connects through the free PurrNet relay, so two developers can test
              together without port forwarding or cloud servers. Add the{" "}
              <code>PurrTransport</code> component to your NetworkManager, enable it, and connect
              using the room code shown in the Editor console.
            </p>
          </div>

          <CodeBlock
            filename="PurrRelayQuickStart.cs"
            language="csharp"
            code={purrRelayCode}
          />

          <Callout type="tip" title="Use Purr Transport for free development relay">
            During early development you rarely want to deal with port forwarding. The Purr
            Transport lets you test multiplayer between two machines instantly at zero cost. Switch
            to KcpTransport (or CompositeTransport) before going to production.
          </Callout>

          <Callout type="info" title="Steam transport requires Steamworks">
            SteamTransport requires the Facepunch.Steamworks or Mirror Steamworks package and a
            valid Steam app ID. The Steamworks client must be running on both machines. It is not
            available in WebGL or console builds. Use CompositeTransport with KCP as a fallback.
          </Callout>

          <Callout type="warning" title="WebSocket has higher latency than UDP">
            WebSocket runs over TCP, which adds head-of-line blocking. For real-time games, prefer
            UDP (KCP) wherever possible and only use WebSocket as a fallback for WebGL or heavily
            firewalled environments.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="Transports"
          description="PurrNet เป็น transport-agnostic สลับ protocol พื้นฐานโดยการลาก Transport component อื่นไปยัง NetworkManager CompositeTransport ให้คุณ bundle transports หลายตัวและ auto-select ที่ดีที่สุดต่อ platform"
          badge="Advanced"
          href="/docs/transports"
        >
          <div className="prose">
            <h2>Transports ที่มีให้ใช้</h2>
            <p>
              แต่ละ transport คือ component ที่อยู่บน GameObject เดียวกับ{" "}
              <code>NetworkManager</code> ของคุณ PurrNet อ่าน transport component ที่ active
              ไว้เมื่อ startup เพิ่มเฉพาะ transport ที่ active ครั้งละหนึ่งตัว หรือใช้{" "}
              <strong>CompositeTransport</strong> เพื่อ bundle หลายตัว
            </p>
          </div>

          <div className="not-prose">
            <ParamTable params={transportTableTH} />
          </div>

          <div className="prose">
            <h2>CompositeTransport — การตั้งค่า multi-platform</h2>
            <p>
              <code>CompositeTransport</code> เก็บ priority-ordered list ของ child transports เมื่อ
              startup จะทดสอบแต่ละตัวตามลำดับและ activate ตัวแรกที่มีให้ใช้บน current platform
              ช่วยให้คุณส่ง single build ที่ใช้ UDP บน PC, WebSocket บน WebGL และ Steam P2P บน
              Steam Deck โดยไม่มี <code>#if</code> guards ในโค้ดของคุณ
            </p>
          </div>

          <CodeBlock
            filename="NetworkManagerSetup.cs"
            language="csharp"
            code={compositeCode}
          />

          <div className="prose">
            <h2>การตั้งค่า KCP (UDP) transport</h2>
            <p>
              UDP transport เริ่มต้น expose Inspector fields หลายตัว การตั้งค่า production ที่พบบ่อย:
            </p>
          </div>

          <CodeBlock
            filename="KcpTransportSettings.cs"
            language="csharp"
            code={kcpCode}
          />

          <div className="prose">
            <h2>Purr Relay — การทดสอบ dev อย่างรวดเร็ว</h2>
            <p>
              Purr Transport เชื่อมต่อผ่าน PurrNet relay ฟรี เพื่อให้นักพัฒนาสองคนสามารถทดสอบ
              ร่วมกันโดยไม่ต้อง port forwarding หรือ cloud servers เพิ่ม component{" "}
              <code>PurrTransport</code> ไปยัง NetworkManager, เปิดใช้งาน และเชื่อมต่อโดยใช้ room
              code ที่แสดงใน Editor console
            </p>
          </div>

          <CodeBlock
            filename="PurrRelayQuickStart.cs"
            language="csharp"
            code={purrRelayCode}
          />

          <Callout type="tip" title="ใช้ Purr Transport สำหรับ free development relay">
            ในช่วง development ต้น คุณมักไม่ต้องการจัดการกับ port forwarding Purr Transport
            ให้คุณ ทดสอบ multiplayer ระหว่างสองเครื่องได้ทันทีโดยไม่มีค่าใช้จ่าย สลับไปยัง
            KcpTransport (หรือ CompositeTransport) ก่อนไป production
          </Callout>

          <Callout type="info" title="Steam transport ต้องการ Steamworks">
            SteamTransport ต้องการ package Facepunch.Steamworks หรือ Mirror Steamworks และ Steam
            app ID ที่ถูกต้อง Steamworks client ต้องทำงานบนทั้งสองเครื่อง ไม่มีให้ใช้ใน WebGL
            หรือ console builds ใช้ CompositeTransport กับ KCP เป็น fallback
          </Callout>

          <Callout type="warning" title="WebSocket มี latency สูงกว่า UDP">
            WebSocket ทำงานบน TCP ซึ่งเพิ่ม head-of-line blocking สำหรับเกม real-time ควรใช้ UDP
            (KCP) ทุกที่ที่เป็นไปได้และใช้ WebSocket เฉพาะเป็น fallback สำหรับ WebGL หรือ
            environments ที่ firewall หนัก
          </Callout>
        </DocPage>
      }
    />
  );
}
