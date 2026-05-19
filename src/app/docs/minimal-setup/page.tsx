import { DocPage } from "@/components/docs/DocPage";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { Callout } from "@/components/docs/Callout";
import { BilingualContent } from "@/components/docs/BilingualContent";

export const metadata = { title: "Minimal Setup" };

const playerControllerCode = `using PurrNet;
using UnityEngine;

public class PlayerController : NetworkBehaviour
{
    [SerializeField] private float speed = 5f;

    protected override void OnSpawned(bool asServer)
    {
        if (isOwner)
        {
            // Only the owner gets the camera
            Camera.main.GetComponent<CameraFollow>().SetTarget(transform);
        }
    }

    void Update()
    {
        if (!isOwner) return; // Only owner drives input

        var move = new Vector3(Input.GetAxis("Horizontal"), 0, Input.GetAxis("Vertical"));
        CmdMove(move * speed * Time.deltaTime);
    }

    [ServerRpc(requireOwnership: true)]
    private void CmdMove(Vector3 delta)
    {
        transform.position += delta;
    }
}`;

const connectionCode = `// Start as host (server + client on same machine)
networkManager.StartHost();

// Or start as server only
networkManager.StartServer();

// Connect as client
networkManager.Connect("127.0.0.1", 7777);`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage title="Minimal Setup" description="Run a networked scene in under 5 minutes." href="/docs/minimal-setup">
          <div className="prose">
            <h2>Step 1: Network Manager</h2>
            <p>Create an empty GameObject in your scene and add a <strong>NetworkManager</strong> component. This is the heart of PurrNet — it manages connections, prefabs, and rules.</p>
            <p>Configure:</p>
            <ul>
              <li><strong>Network Rules</strong> — drag in a preset (ServerStrict is recommended for new projects)</li>
              <li><strong>Transport</strong> — add a <code>UDPTransport</code> component to the same GameObject</li>
              <li><strong>Network Prefabs</strong> — register the prefabs you plan to spawn over the network</li>
            </ul>
            <h2>Step 2: Your first NetworkBehaviour</h2>
          </div>
          <CodeBlock filename="PlayerController.cs" language="csharp" code={playerControllerCode} />
          <div className="prose">
            <h2>Step 3: Host &amp; Connect</h2>
            <p>Call these from a UI button or Awake:</p>
          </div>
          <CodeBlock language="csharp" code={connectionCode} />
          <Callout type="tip">For local testing without a build: use <strong>ParrelSync</strong> or Unity&apos;s <em>Multiplayer Play Mode</em> package to run multiple editors simultaneously.</Callout>
        </DocPage>
      }
      th={
        <DocPage title="การตั้งค่าขั้นต่ำ" description="รัน networked scene ในเวลาน้อยกว่า 5 นาที" href="/docs/minimal-setup">
          <div className="prose">
            <h2>ขั้นตอนที่ 1: Network Manager</h2>
            <p>สร้าง GameObject ว่างในฉากของคุณและเพิ่มคอมโพเนนต์ <strong>NetworkManager</strong> นี่คือหัวใจของ PurrNet — จัดการการเชื่อมต่อ prefabs และ rules</p>
            <p>กำหนดค่า:</p>
            <ul>
              <li><strong>Network Rules</strong> — ลาก preset เข้ามา (แนะนำ ServerStrict สำหรับโครงการใหม่)</li>
              <li><strong>Transport</strong> — เพิ่มคอมโพเนนต์ <code>UDPTransport</code> ให้กับ GameObject เดิม</li>
              <li><strong>Network Prefabs</strong> — ลงทะเบียน prefabs ที่คุณวางแผนจะ spawn ผ่านเครือข่าย</li>
            </ul>
            <h2>ขั้นตอนที่ 2: NetworkBehaviour แรกของคุณ</h2>
          </div>
          <CodeBlock filename="PlayerController.cs" language="csharp" code={playerControllerCode} />
          <div className="prose">
            <h2>ขั้นตอนที่ 3: Host & Connect</h2>
            <p>เรียกสิ่งเหล่านี้จากปุ่ม UI หรือ Awake:</p>
          </div>
          <CodeBlock language="csharp" code={connectionCode} />
          <Callout type="tip">สำหรับการทดสอบในเครื่องเดียวโดยไม่ต้อง build: ใช้ <strong>ParrelSync</strong> หรือแพ็กเกจ <em>Multiplayer Play Mode</em> ของ Unity เพื่อรันหลาย editor พร้อมกัน</Callout>
        </DocPage>
      }
    />
  );
}
