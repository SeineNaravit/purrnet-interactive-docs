import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";
import { SideScroll25DViz } from "@/components/visualizers/SideScroll25DViz";

export const metadata = { title: "2.5D Side Scrolling Controller" };

const apiParamsEN = [
  { name: "_depthLane (SyncVar<int>)", type: "SyncVar", description: "The current depth lane index (0=front, 1=mid, 2=back). Synced with ownerAuth:true. Non-owners tween Z toward the target lane position." },
  { name: "SwitchLaneServerRpc(int lane)", type: "ServerRpc", description: "Owner sends desired lane index. Server validates, updates _depthLane, and moves the rigidbody to the new Z position." },
  { name: "_animState (SyncVar<int>)", type: "SyncVar", description: "Same as 2D: 0=Idle, 1=Walk, 2=Jump, 3=Fall, 4=Attack. Drives the Animator on all peers." },
  { name: "NetworkTransform", type: "component", description: "Syncs X (horizontal), Y (jump height), and Z (depth lane position). Enable all 3 axes." },
  { name: "_lanePositions[]", type: "float[]", description: "Server-side array mapping lane index to world Z. Typically: { 0f, -2f, -4f } for front/mid/back." },
];

const apiParamsTH = [
  { name: "_depthLane (SyncVar<int>)", type: "SyncVar", description: "Index ของ depth lane ปัจจุบัน (0=หน้า, 1=กลาง, 2=หลัง) sync ด้วย ownerAuth:true non-owners tween Z ไปยังตำแหน่ง lane เป้าหมาย" },
  { name: "SwitchLaneServerRpc(int lane)", type: "ServerRpc", description: "Owner ส่ง lane index ที่ต้องการ Server validate อัปเดต _depthLane และย้าย rigidbody ไปยัง Z position ใหม่" },
  { name: "_animState (SyncVar<int>)", type: "SyncVar", description: "เหมือนกับ 2D: 0=Idle, 1=Walk, 2=Jump, 3=Fall, 4=Attack ขับเคลื่อน Animator บนทุก peer" },
  { name: "NetworkTransform", type: "component", description: "Sync X (แนวนอน), Y (ความสูงของ jump) และ Z (ตำแหน่ง depth lane) เปิดใช้งานทั้ง 3 แกน" },
  { name: "_lanePositions[]", type: "float[]", description: "Array ฝั่ง server ที่ map lane index ไปยัง world Z โดยทั่วไป: { 0f, -2f, -4f } สำหรับหน้า/กลาง/หลัง" },
];

const controllerCode = `using PurrNet;
using UnityEngine;

[RequireComponent(typeof(Rigidbody2D), typeof(NetworkTransform))]
public class NetworkSideScroll25D : NetworkBehaviour
{
    [Header("Movement")]
    [SerializeField] private float   _moveSpeed  = 6f;
    [SerializeField] private float   _jumpForce  = 12f;
    [SerializeField] private float[] _lanePositions = { 0f, -2f, -4f };
    [SerializeField] private float   _laneSwitchSpeed = 8f;
    [SerializeField] private LayerMask _ground;

    [Header("References")]
    [SerializeField] private Animator       _anim;
    [SerializeField] private SpriteRenderer _sprite;
    [SerializeField] private Transform      _groundCheck;

    // ── Network state ─────────────────────────────────────────────────────────

    private SyncVar<int>  _animState   = new(0);
    private SyncVar<bool> _facingRight = new(true, ownerAuth: true);
    private SyncVar<int>  _depthLane   = new(0,    ownerAuth: true);

    private Rigidbody2D _rb;
    private bool        _isGrounded;
    private float       _targetZ;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected override void OnSpawned()
    {
        _rb = GetComponent<Rigidbody2D>();
        _targetZ = LaneToZ(_depthLane.value);

        _facingRight.onChanged += (_, r)  => _sprite.flipX = !r;
        _animState.onChanged   += (_, s)  => _anim.SetInteger("State", s);
        _depthLane.onChanged   += (_, lane) => _targetZ = LaneToZ(lane);
    }

    private void Update()
    {
        _isGrounded = Physics2D.OverlapCircle(_groundCheck.position, 0.1f, _ground);

        // Smooth Z lerp applies on ALL peers (owner already at target, observers catching up)
        Vector3 pos = transform.position;
        pos.z = Mathf.Lerp(pos.z, _targetZ, _laneSwitchSpeed * Time.deltaTime);
        transform.position = pos;

        if (isOwner) OwnerUpdate();
    }

    // ── Owner input ───────────────────────────────────────────────────────────

    private void OwnerUpdate()
    {
        float h = Input.GetAxisRaw("Horizontal");
        _rb.linearVelocity = new Vector2(h * _moveSpeed, _rb.linearVelocity.y);

        if (h != 0) _facingRight.value = h > 0;

        int state = 0;
        if (!_isGrounded)  state = _rb.linearVelocity.y > 0 ? 2 : 3;
        else if (h != 0)   state = 1;
        _animState.value = state;

        if (Input.GetButtonDown("Jump") && _isGrounded)
            JumpServerRpc();

        // Depth lane: Q = move toward screen, E = move away
        if (Input.GetKeyDown(KeyCode.Q))
            SwitchLaneServerRpc(Mathf.Max(0, _depthLane.value - 1));
        if (Input.GetKeyDown(KeyCode.E))
            SwitchLaneServerRpc(Mathf.Min(_lanePositions.Length - 1, _depthLane.value + 1));
    }

    // ── ServerRpcs ────────────────────────────────────────────────────────────

    [ServerRpc]
    private void JumpServerRpc()
        => _rb.AddForce(Vector2.up * _jumpForce, ForceMode2D.Impulse);

    /// <summary>
    /// Server validates the lane index and updates the SyncVar.
    /// All peers lerp toward the new Z via _depthLane.onChanged.
    /// </summary>
    [ServerRpc]
    private void SwitchLaneServerRpc(int lane)
    {
        if ((uint)lane >= (uint)_lanePositions.Length) return;

        _depthLane.value = lane;

        // Move rigidbody to new lane Z immediately on server
        Vector3 pos = transform.position;
        pos.z = _lanePositions[lane];
        transform.position = pos;
    }

    // ── Sorting & camera ──────────────────────────────────────────────────────

    private void LateUpdate()
    {
        // Adjust sort order so front-lane characters draw over back-lane ones
        if (_sprite != null)
            _sprite.sortingOrder = -_depthLane.value;
    }

    private float LaneToZ(int lane)
        => (uint)lane < (uint)_lanePositions.Length ? _lanePositions[lane] : 0f;
}`;

const cameraCode = `using PurrNet;
using UnityEngine;

/// <summary>
/// Follows the local player. In 2.5D the camera X tracks the player,
/// Y is fixed, and Z is slightly pulled back to show lane depth.
/// </summary>
public class SideScrollCamera : MonoBehaviour
{
    [SerializeField] private float _smoothSpeed = 6f;
    [SerializeField] private Vector3 _offset = new(0, 2, -10);

    private Transform _target;

    private void LateUpdate()
    {
        if (_target == null)
        {
            // Find the local player once they spawn
            if (NetworkSideScroll25D.localPlayer is { } p)
                _target = p.transform;
            return;
        }

        // Only follow X — lock Y and Z for the 2.5D feel
        Vector3 desired = new Vector3(
            _target.position.x + _offset.x,
            _offset.y,
            _offset.z
        );
        transform.position = Vector3.Lerp(transform.position, desired, _smoothSpeed * Time.deltaTime);
    }
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="2.5D Side Scrolling Controller"
          description="A 2.5D platformer controller for PurrNet. Characters move on the X/Y plane like a classic 2D side-scroller, but can switch between depth lanes (front / mid / back) on the Z axis. NetworkTransform syncs all three axes; the depth lane SyncVar drives smooth Z interpolation on every peer."
          badge="Example"
          href="/docs/2-5d-side-scrolling-controller"
        >
          <SideScroll25DViz />

          <div className="prose">
            <h2>What makes 2.5D different from 2D</h2>
            <p>
              The key addition is the <strong>depth lane</strong> system. Characters live on a
              shared X/Y rail but can step between discrete Z positions (lanes). Movement is still
              purely horizontal, but lane-switching changes Z — which the camera and sprite sorter
              use to create the depth illusion.
            </p>
            <p>
              Over the network, the lane is stored as a <code>SyncVar&lt;int&gt;</code> with{" "}
              <code>ownerAuth: true</code>. All peers run the same lerp logic in{" "}
              <code>Update()</code>, so the transition looks smooth everywhere — no extra RPC needed
              just for the visual interpolation.
            </p>
          </div>
          <div className="not-prose"><ParamTable params={apiParamsEN} /></div>

          <div className="prose"><h2>Full controller</h2></div>
          <CodeBlock filename="NetworkSideScroll25D.cs" language="csharp" code={controllerCode} />

          <div className="prose"><h2>Camera follow</h2></div>
          <CodeBlock filename="SideScrollCamera.cs" language="csharp" code={cameraCode} />

          <Callout type="tip" title="Use sortingOrder to fake depth">
            Call <code>spriteRenderer.sortingOrder = -depthLane</code> in <code>LateUpdate</code>.
            Front-lane characters (lane 0) get <code>sortingOrder 0</code>; back-lane characters get
            negative values, placing them behind. No camera tricks needed.
          </Callout>
          <Callout type="info" title="Enable all 3 axes on NetworkTransform">
            By default NetworkTransform may only sync X and Y. Enable Z sync as well — the lane Z
            position must be authoritative so late-joining clients spawn in the right lane.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="2.5D Side Scrolling Controller"
          description="Controller 2.5D platformer สำหรับ PurrNet ตัวละครเคลื่อนที่บนระนาบ X/Y เหมือน side-scroller 2D แบบคลาสสิก แต่สามารถสลับระหว่าง depth lanes (หน้า/กลาง/หลัง) บนแกน Z ได้ NetworkTransform sync ทั้งสามแกน; depth lane SyncVar ขับ Z interpolation แบบ smooth บนทุก peer"
          badge="Example"
          href="/docs/2-5d-side-scrolling-controller"
        >
          <SideScroll25DViz />
          <div className="prose">
            <h2>สิ่งที่ทำให้ 2.5D แตกต่างจาก 2D</h2>
            <p>สิ่งที่เพิ่มมาคือระบบ <strong>depth lane</strong> ตัวละครอยู่บน X/Y rail เดียวกัน แต่สามารถก้าวระหว่างตำแหน่ง Z แบบ discrete (lanes) ได้ การเคลื่อนที่ยังคงเป็นแนวนอนเท่านั้น แต่การสลับ lane เปลี่ยน Z — ซึ่ง camera และ sprite sorter ใช้เพื่อสร้างภาพลวงตาของความลึก บนเครือข่าย lane ถูกเก็บเป็น <code>SyncVar&lt;int&gt;</code> ที่มี <code>ownerAuth: true</code> ทุก peer รัน logic lerp เดียวกันใน <code>Update()</code> ดังนั้น transition จึงดู smooth ทุกที่</p>
          </div>
          <div className="not-prose"><ParamTable params={apiParamsTH} /></div>
          <div className="prose"><h2>Controller เต็มรูปแบบ</h2></div>
          <CodeBlock filename="NetworkSideScroll25D.cs" language="csharp" code={controllerCode} />
          <div className="prose"><h2>Camera follow</h2></div>
          <CodeBlock filename="SideScrollCamera.cs" language="csharp" code={cameraCode} />
          <Callout type="tip" title="ใช้ sortingOrder เพื่อสร้างความลึก">เรียก <code>spriteRenderer.sortingOrder = -depthLane</code> ใน <code>LateUpdate</code> ตัวละครที่ lane หน้า (lane 0) ได้ <code>sortingOrder 0</code>; ตัวละครที่ lane หลังได้ค่าลบ วางไว้ด้านหลัง ไม่ต้องใช้ camera tricks</Callout>
          <Callout type="info" title="เปิดใช้งานทั้ง 3 แกนบน NetworkTransform">โดยค่าเริ่มต้น NetworkTransform อาจ sync เฉพาะ X และ Y เท่านั้น เปิดใช้งาน Z sync ด้วย — lane Z position ต้องเป็น authoritative เพื่อให้ client ที่ join ช้า spawn ใน lane ที่ถูกต้อง</Callout>
        </DocPage>
      }
    />
  );
}
