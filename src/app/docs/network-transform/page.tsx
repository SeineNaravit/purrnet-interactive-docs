import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { NetworkTransformVisualizer } from "@/components/visualizers/NetworkTransformVisualizer";
import { BilingualContent } from "@/components/docs/BilingualContent";

export const metadata = { title: "Network Transform" };

const inspectorParamsEN = [
  { name: "Sync Position", type: "bool", default: "true", description: "Synchronise the transform's world position across all clients." },
  { name: "Sync Rotation", type: "bool", default: "true", description: "Synchronise the transform's rotation (Quaternion)." },
  { name: "Sync Scale", type: "bool", default: "false", description: "Synchronise the transform's local scale. Only enable if scale actually changes at runtime." },
  { name: "Sync Parent", type: "bool", default: "false", description: "Synchronise parent changes. Enable for pick-up mechanics or vehicle boarding." },
  { name: "Owner Auth", type: "bool", default: "true", description: "When true, the owner sends position updates. When false, the server is the sole authority." },
  { name: "Interpolate", type: "bool", default: "true", description: "Smooth movement between received snapshots on remote clients. Disable for teleportation." },
  { name: "Send Interval (ticks)", type: "int", default: "1", description: "How many ticks between position broadcasts. Higher = lower bandwidth, choppier movement." },
  { name: "Position Tolerance", type: "float", default: "0.001", description: "Minimum position delta before a sync is sent. Prevents micro-updates when standing still." },
  { name: "Rotation Tolerance", type: "float", default: "0.01", description: "Minimum angle change (degrees) before a rotation sync is sent." },
];

const inspectorParamsTH = [
  { name: "Sync Position", type: "bool", default: "true", description: "ซิงโครไนซ์ world position ของ transform ทั่ว clients ทั้งหมด" },
  { name: "Sync Rotation", type: "bool", default: "true", description: "ซิงโครไนซ์ rotation ของ transform (Quaternion)" },
  { name: "Sync Scale", type: "bool", default: "false", description: "ซิงโครไนซ์ local scale ของ transform เปิดใช้เฉพาะเมื่อ scale เปลี่ยนแปลงจริงๆ ขณะ runtime" },
  { name: "Sync Parent", type: "bool", default: "false", description: "ซิงโครไนซ์การเปลี่ยน parent เปิดใช้สำหรับ pick-up mechanics หรือการขึ้นยานพาหนะ" },
  { name: "Owner Auth", type: "bool", default: "true", description: "เมื่อ true owner ส่ง position updates เมื่อ false server เป็น authority เดียว" },
  { name: "Interpolate", type: "bool", default: "true", description: "ทำให้การเคลื่อนที่ smooth ระหว่าง snapshots ที่ได้รับบน remote clients ปิดสำหรับ teleportation" },
  { name: "Send Interval (ticks)", type: "int", default: "1", description: "จำนวน ticks ระหว่าง position broadcasts มากขึ้น = bandwidth ลดลง การเคลื่อนที่ไม่ราบรื่น" },
  { name: "Position Tolerance", type: "float", default: "0.001", description: "Position delta ขั้นต่ำก่อนที่จะส่ง sync ป้องกัน micro-updates เมื่อยืนอยู่กับที่" },
  { name: "Rotation Tolerance", type: "float", default: "0.01", description: "การเปลี่ยนแปลงมุมขั้นต่ำ (degrees) ก่อนที่จะส่ง rotation sync" },
];

const teleportCode = `using PurrNet;
using UnityEngine;

public class TeleportSystem : NetworkBehaviour
{
    [SerializeField] private NetworkTransform netTransform;

    // Server teleports the player to a specific position
    [ObserversRpc(runLocally: true)]
    public void RpcTeleport(Vector3 destination)
    {
        // Disable interpolation so the client snaps immediately
        netTransform.interpolate = false;
        transform.position = destination;

        // Re-enable interpolation next frame for smooth subsequent movement
        StartCoroutine(ReenableInterpolation());
    }

    private System.Collections.IEnumerator ReenableInterpolation()
    {
        yield return null;
        netTransform.interpolate = true;
    }
}`;

const vehicleCode = `public class VehicleController : NetworkBehaviour
{
    [SerializeField] private Transform driverSeat;
    [SerializeField] private NetworkTransform playerNetTransform;

    [ServerRpc(requireOwnership: false)]
    public void CmdBoard(NetworkIdentity playerIdentity, RPCInfo info = default)
    {
        if (!info.asServer) return;

        // Give vehicle ownership to the boarding player
        GiveOwnership(info.sender);

        // Parent the player to the vehicle seat
        // NetworkTransform with SyncParent=true will sync this reparenting
        playerIdentity.transform.SetParent(driverSeat);
        playerIdentity.transform.localPosition = Vector3.zero;
    }

    [ServerRpc(requireOwnership: true)]
    public void CmdExit(NetworkIdentity playerIdentity)
    {
        playerIdentity.transform.SetParent(null); // detach
        GiveOwnership(null); // remove vehicle owner
    }
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="Network Transform"
          description="NetworkTransform is a plug-and-play component that automatically synchronises position, rotation, scale, and parent across all clients. Attach it to any GameObject with a NetworkIdentity."
          badge="Plug & Play"
          href="/docs/network-transform"
        >
          <div className="not-prose mb-6">
            <NetworkTransformVisualizer showControls />
          </div>

          <div className="prose">
            <h2>Setup</h2>
            <p>
              Add the <code>NetworkTransform</code> component to a GameObject that already has a{" "}
              <code>NetworkIdentity</code> or <code>NetworkBehaviour</code>. No code required for basic usage.
            </p>
            <p>
              The component automatically detects authority: if <strong>Owner Auth</strong> is enabled, the owner&apos;s
              position is broadcast to everyone else. If disabled, only the server can push position updates.
            </p>

            <h2>Inspector settings</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={inspectorParamsEN} />
          </div>

          <div className="prose">
            <h2>Interpolation explained</h2>
            <p>
              Without interpolation, remote clients &quot;snap&quot; to new positions whenever a packet arrives —
              creating choppy, teleporting movement. With interpolation enabled, the component smoothly moves the object
              between the last received position and the newly received one over the expected tick interval, hiding
              network jitter.
            </p>
            <p>
              The dashed outline in the visualizer above shows the true authority position. The solid character on the
              remote side shows the interpolated position — lagging behind but smoothly tracking.
            </p>

            <h2>Teleportation (disabling interpolation temporarily)</h2>
          </div>

          <CodeBlock filename="TeleportSystem.cs" language="csharp" code={teleportCode} />

          <div className="prose">
            <h2>Situational example — Vehicle boarding</h2>
            <p>
              When a player boards a vehicle, you need to sync both the vehicle position AND reparent the player to the
              vehicle. Enable <strong>Sync Parent</strong> on the player&apos;s NetworkTransform.
            </p>
          </div>

          <CodeBlock filename="VehicleController.cs" language="csharp" code={vehicleCode} />

          <Callout type="warning" title="Don't override transform directly on remote clients">
            Setting <code>transform.position</code> directly on a non-authority client will be overwritten by the next
            NetworkTransform sync. Only modify position on the authority (owner or server). Use{" "}
            <code>if (isOwner)</code> or <code>if (isServer)</code> guards.
          </Callout>

          <Callout type="tip" title="Bandwidth optimization">
            Disable sync axes you don&apos;t need. A 2D game that never changes scale or Z position wastes bandwidth
            syncing those values every tick. Use tolerance values to suppress micro-updates when the object is
            stationary.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="Network Transform"
          description="NetworkTransform คือ component แบบ plug-and-play ที่ซิงโครไนซ์ position, rotation, scale และ parent ทั่ว clients ทั้งหมดโดยอัตโนมัติ ติดกับ GameObject ใดก็ได้ที่มี NetworkIdentity"
          badge="Plug & Play"
          href="/docs/network-transform"
        >
          <div className="not-prose mb-6">
            <NetworkTransformVisualizer showControls />
          </div>

          <div className="prose">
            <h2>การตั้งค่า</h2>
            <p>
              เพิ่ม component <code>NetworkTransform</code> ไปยัง GameObject ที่มี{" "}
              <code>NetworkIdentity</code> หรือ <code>NetworkBehaviour</code> อยู่แล้ว ไม่ต้องเขียนโค้ดสำหรับการใช้งานพื้นฐาน
            </p>
            <p>
              Component จะตรวจจับ authority โดยอัตโนมัติ: ถ้า <strong>Owner Auth</strong> เปิดใช้งาน
              position ของ owner จะ broadcast ไปยังคนอื่น ถ้าปิดใช้งาน เฉพาะ server เท่านั้นที่สามารถ push position updates
            </p>

            <h2>การตั้งค่า Inspector</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={inspectorParamsTH} />
          </div>

          <div className="prose">
            <h2>อธิบาย Interpolation</h2>
            <p>
              โดยไม่มี interpolation remote clients จะ &quot;snap&quot; ไปยัง positions ใหม่เมื่อ packet มาถึง
              — ทำให้การเคลื่อนที่กระตุกและดูเหมือน teleport เมื่อเปิดใช้ interpolation component จะ
              เคลื่อนย้าย object อย่างราบรื่นระหว่าง position ที่ได้รับล่าสุดกับ position ที่ได้รับใหม่
              ตลอด tick interval ที่คาดไว้ ซ่อน network jitter
            </p>
            <p>
              เส้นประในวิสุอลไลเซอร์ด้านบนแสดง true authority position ตัวละครที่เป็น solid ทางฝั่ง
              remote แสดง interpolated position — ล่าช้าแต่ tracking อย่างราบรื่น
            </p>

            <h2>Teleportation (ปิด interpolation ชั่วคราว)</h2>
          </div>

          <CodeBlock filename="TeleportSystem.cs" language="csharp" code={teleportCode} />

          <div className="prose">
            <h2>ตัวอย่างสถานการณ์ — การขึ้นยานพาหนะ</h2>
            <p>
              เมื่อผู้เล่นขึ้นยานพาหนะ คุณต้อง sync ทั้ง vehicle position และ reparent
              ผู้เล่นไปยังยานพาหนะ เปิด <strong>Sync Parent</strong> บน NetworkTransform ของผู้เล่น
            </p>
          </div>

          <CodeBlock filename="VehicleController.cs" language="csharp" code={vehicleCode} />

          <Callout type="warning" title="อย่า override transform โดยตรงบน remote clients">
            การตั้งค่า <code>transform.position</code> โดยตรงบน non-authority client จะถูก overwrite
            โดย NetworkTransform sync ถัดไป แก้ไข position บน authority เท่านั้น (owner หรือ server)
            ใช้ <code>if (isOwner)</code> หรือ <code>if (isServer)</code> guards
          </Callout>

          <Callout type="tip" title="การ optimize bandwidth">
            ปิด sync axes ที่ไม่ต้องการ เกม 2D ที่ไม่เปลี่ยน scale หรือ Z position
            สิ้นเปลือง bandwidth ในการ sync ค่าเหล่านั้นทุก tick ใช้ tolerance values เพื่อ suppress
            micro-updates เมื่อ object อยู่นิ่ง
          </Callout>
        </DocPage>
      }
    />
  );
}
