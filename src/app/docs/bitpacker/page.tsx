import { DocPage } from "@/components/docs/DocPage";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ParamTable } from "@/components/docs/ParamTable";
import { BilingualContent } from "@/components/docs/BilingualContent";

export const metadata = { title: "BitPacker Serialization" };

const bitpackerMethodsEN = [
  {
    name: "PackInt(ref int value, int min, int max)",
    type: "void",
    description:
      "Pack an integer using the minimum number of bits required to represent the [min, max] range. Dramatically reduces bandwidth for small-range integers.",
  },
  {
    name: "PackFloat(ref float value, float min, float max, int bits)",
    type: "void",
    description:
      "Quantize a float to a fixed bit count within [min, max]. E.g. 8 bits gives 256 steps across the range.",
  },
  {
    name: "PackBool(ref bool value)",
    type: "void",
    description: "Pack a boolean as a single bit.",
  },
  {
    name: "PackString(ref string value)",
    type: "void",
    description: "Pack a UTF-8 string with a compact length prefix.",
  },
  {
    name: "PackBytes(ref byte[] value)",
    type: "void",
    description: "Pack a raw byte array with a compact length prefix.",
  },
  {
    name: "PackEnum<T>(ref T value)",
    type: "void",
    description:
      "Pack an enum using only the bits needed to represent its declared values.",
  },
];

const bitpackerMethodsTH = [
  {
    name: "PackInt(ref int value, int min, int max)",
    type: "void",
    description:
      "Pack integer โดยใช้จำนวน bits ขั้นต่ำที่จำเป็นสำหรับช่วง [min, max] ลด bandwidth อย่างมากสำหรับ integers ที่มีช่วงเล็ก",
  },
  {
    name: "PackFloat(ref float value, float min, float max, int bits)",
    type: "void",
    description:
      "Quantize float เป็น bit count คงที่ภายใน [min, max] เช่น 8 bits ให้ 256 steps ตลอดช่วง",
  },
  {
    name: "PackBool(ref bool value)",
    type: "void",
    description: "Pack boolean เป็น bit เดียว",
  },
  {
    name: "PackString(ref string value)",
    type: "void",
    description: "Pack UTF-8 string พร้อม length prefix แบบ compact",
  },
  {
    name: "PackBytes(ref byte[] value)",
    type: "void",
    description: "Pack raw byte array พร้อม length prefix แบบ compact",
  },
  {
    name: "PackEnum<T>(ref T value)",
    type: "void",
    description:
      "Pack enum โดยใช้เฉพาะ bits ที่จำเป็นเพื่อแสดง declared values ของมัน",
  },
];

const interfaceParamsEN = [
  {
    name: "IPackedAuto",
    type: "interface",
    description:
      "Marker interface — PurrNet automatically serializes all public fields using reflection. Zero boilerplate. Best for simple, flat structs.",
  },
  {
    name: "IPacked",
    type: "interface",
    description:
      "Manual serialization interface. Implement Pack(BitPacker) and Unpack(BitPacker) for full control — use quantized floats, delta encoding, and bit flags.",
  },
  {
    name: "[RegisterNetworkType(typeof(T))]",
    type: "attribute",
    description:
      "Required on any custom struct or class used in SyncVars or RPC parameters. Registers the type with PurrNet's serializer at startup.",
  },
];

const interfaceParamsTH = [
  {
    name: "IPackedAuto",
    type: "interface",
    description:
      "Marker interface — PurrNet serialize public fields ทั้งหมดโดยใช้ reflection โดยอัตโนมัติ ไม่มี boilerplate เหมาะสำหรับ structs ที่เรียบง่าย flat",
  },
  {
    name: "IPacked",
    type: "interface",
    description:
      "Manual serialization interface Implement Pack(BitPacker) และ Unpack(BitPacker) สำหรับการควบคุมเต็มรูปแบบ — ใช้ quantized floats, delta encoding และ bit flags",
  },
  {
    name: "[RegisterNetworkType(typeof(T))]",
    type: "attribute",
    description:
      "จำเป็นสำหรับ custom struct หรือ class ที่ใช้ใน SyncVars หรือ RPC parameters ลงทะเบียน type กับ serializer ของ PurrNet เมื่อ startup",
  },
];

const playerStateCode = `using PurrNet;
using UnityEngine;

// IPackedAuto: PurrNet serializes all public fields automatically
[RegisterNetworkType(typeof(PlayerState))]
public struct PlayerState : IPackedAuto
{
    public Vector3 position;
    public float   health;
    public int     score;
    public string  displayName;
    public bool    isAlive;
}

// Use in a SyncVar like any built-in type
public class PlayerStats : NetworkBehaviour
{
    private SyncVar<PlayerState> _state = new(new PlayerState
    {
        health = 100f,
        isAlive = true,
        displayName = "Player",
    });

    public void UpdateState(Vector3 pos, float hp)
    {
        if (!isServer) return;
        _state.value = new PlayerState
        {
            position    = pos,
            health      = hp,
            score       = _state.value.score,
            displayName = _state.value.displayName,
            isAlive     = hp > 0f,
        };
    }
}`;

const damagePacketCode = `using PurrNet;
using UnityEngine;

// IPacked: full manual control — every bit counts
[RegisterNetworkType(typeof(DamagePacket))]
public struct DamagePacket : IPacked
{
    // Damage 0–500 needs 9 bits (vs 32 for int)
    public int     damage;

    // Direction as two quantized floats — 8 bits each instead of 96
    public Vector3 hitDirection;

    // Bit flags for hit type — 1 bit each
    public bool isCritical;
    public bool isPenetrating;
    public bool isHeadshot;

    // Hit location enum — only 4 values, needs 2 bits
    public HitLocation location;

    public void Pack(BitPacker packer)
    {
        packer.PackInt(ref damage, 0, 500);                   // 9 bits
        float dx = hitDirection.x, dy = hitDirection.y, dz = hitDirection.z;
        packer.PackFloat(ref dx, -1f, 1f, 8);                // 8 bits
        packer.PackFloat(ref dy, -1f, 1f, 8);                // 8 bits
        packer.PackFloat(ref dz, -1f, 1f, 8);                // 8 bits
        hitDirection = new Vector3(dx, dy, dz);

        packer.PackBool(ref isCritical);                      // 1 bit
        packer.PackBool(ref isPenetrating);                   // 1 bit
        packer.PackBool(ref isHeadshot);                      // 1 bit
        packer.PackEnum(ref location);                        // 2 bits
        // Total: ~46 bits vs 160 bits with IPackedAuto — 71% smaller
    }

    public void Unpack(BitPacker packer)
    {
        // Unpack in the same order as Pack
        Pack(packer);
    }
}

public enum HitLocation { Body, Head, Limb, Shield }`;

const statusFlagsCode = `using PurrNet;

[RegisterNetworkType(typeof(StatusFlags))]
public struct StatusFlags : IPacked
{
    public bool isBurning;
    public bool isPoisoned;
    public bool isStunned;
    public bool isRooted;
    public bool isInvisible;
    public bool isShielded;
    public bool isHasted;
    public bool isSlowed;

    public void Pack(BitPacker packer)
    {
        // Each PackBool writes exactly 1 bit — 8 booleans = 1 byte total
        packer.PackBool(ref isBurning);
        packer.PackBool(ref isPoisoned);
        packer.PackBool(ref isStunned);
        packer.PackBool(ref isRooted);
        packer.PackBool(ref isInvisible);
        packer.PackBool(ref isShielded);
        packer.PackBool(ref isHasted);
        packer.PackBool(ref isSlowed);
    }

    public void Unpack(BitPacker packer) => Pack(packer);
}

// Usage in a NetworkBehaviour
public class StatusEffects : NetworkBehaviour
{
    private SyncVar<StatusFlags> _flags = new(default);

    public void ApplyBurn()
    {
        if (!isServer) return;
        var f = _flags.value;
        f.isBurning = true;
        _flags.value = f;
    }
}`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage
          title="BitPacker Serialization"
          description="BitPacker is PurrNet's low-level binary serializer. It writes data bit-by-bit, letting you pack integers into the minimum number of bits they need and quantize floats to save bandwidth on custom network types."
          badge="Advanced"
          href="/docs/bitpacker"
        >
          <div className="prose">
            <h2>Two serialization modes</h2>
            <p>
              PurrNet supports two interfaces for custom type serialization, suited to different use
              cases:
            </p>
          </div>

          <div className="not-prose">
            <ParamTable params={interfaceParamsEN} />
          </div>

          <div className="prose">
            <h2>BitPacker methods</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={bitpackerMethodsEN} />
          </div>

          <div className="prose">
            <h2>IPackedAuto — simple structs</h2>
            <p>
              For data that has no special packing requirements, implement <code>IPackedAuto</code>{" "}
              and annotate the type with <code>[RegisterNetworkType]</code>. PurrNet reflects over
              all public fields and serializes them automatically.
            </p>
          </div>

          <CodeBlock
            filename="PlayerState.cs"
            language="csharp"
            code={playerStateCode}
          />

          <div className="prose">
            <h2>IPacked — manual control with delta compression</h2>
            <p>
              When bandwidth matters, implement <code>IPacked</code> and hand-write the Pack/Unpack
              methods. This lets you quantize floats (e.g. pack an angle as 8 bits instead of 32),
              combine booleans into a single bit field, or omit fields that haven&apos;t changed.
            </p>
          </div>

          <CodeBlock
            filename="DamagePacket.cs"
            language="csharp"
            code={damagePacketCode}
          />

          <div className="prose">
            <h2>Packing multiple booleans as bit flags</h2>
            <p>
              A struct with eight booleans using <code>IPackedAuto</code> costs 8 bytes. With manual
              packing, all eight fit in a single byte:
            </p>
          </div>

          <CodeBlock
            filename="StatusFlags.cs"
            language="csharp"
            code={statusFlagsCode}
          />

          <Callout type="tip" title="Use IPackedAuto for simple structs">
            Unless you have a specific bandwidth requirement, start with <code>IPackedAuto</code>.
            It requires zero boilerplate and handles all primitive types, <code>Vector3</code>,{" "}
            <code>Quaternion</code>, <code>string</code>, and enums automatically. Migrate to{" "}
            <code>IPacked</code> only when profiling shows the struct is on a hot send path.
          </Callout>

          <Callout type="warning" title="Struct layout changes break compatibility">
            If you change the field order or add/remove fields on an <code>IPackedAuto</code>{" "}
            struct, old clients will misread the data and potentially crash. When shipping updates,
            version your packets: add a version field at the front, or use a new type name, to
            maintain backward compatibility during rolling deploys.
          </Callout>
        </DocPage>
      }
      th={
        <DocPage
          title="BitPacker Serialization"
          description="BitPacker คือ low-level binary serializer ของ PurrNet มันเขียนข้อมูลทีละ bit ให้คุณ pack integers เป็น bits จำนวนน้อยที่สุดที่จำเป็นและ quantize floats เพื่อประหยัด bandwidth บน custom network types"
          badge="Advanced"
          href="/docs/bitpacker"
        >
          <div className="prose">
            <h2>สอง serialization modes</h2>
            <p>
              PurrNet รองรับสอง interfaces สำหรับ custom type serialization เหมาะกับ use cases
              ต่างกัน:
            </p>
          </div>

          <div className="not-prose">
            <ParamTable params={interfaceParamsTH} />
          </div>

          <div className="prose">
            <h2>BitPacker methods</h2>
          </div>

          <div className="not-prose">
            <ParamTable params={bitpackerMethodsTH} />
          </div>

          <div className="prose">
            <h2>IPackedAuto — structs ที่เรียบง่าย</h2>
            <p>
              สำหรับข้อมูลที่ไม่มีความต้องการการ packing พิเศษ implement <code>IPackedAuto</code>{" "}
              และ annotate type ด้วย <code>[RegisterNetworkType]</code> PurrNet reflect ผ่าน public
              fields ทั้งหมดและ serialize โดยอัตโนมัติ
            </p>
          </div>

          <CodeBlock
            filename="PlayerState.cs"
            language="csharp"
            code={playerStateCode}
          />

          <div className="prose">
            <h2>IPacked — การควบคุมด้วยตนเองพร้อม delta compression</h2>
            <p>
              เมื่อ bandwidth มีความสำคัญ implement <code>IPacked</code> และเขียน Pack/Unpack
              methods ด้วยตนเอง ช่วยให้คุณ quantize floats (เช่น pack มุมเป็น 8 bits แทน 32),
              รวม booleans เป็น single bit field หรือ omit fields ที่ไม่เปลี่ยนแปลง
            </p>
          </div>

          <CodeBlock
            filename="DamagePacket.cs"
            language="csharp"
            code={damagePacketCode}
          />

          <div className="prose">
            <h2>การ Pack booleans หลายตัวเป็น bit flags</h2>
            <p>
              struct ที่มี eight booleans โดยใช้ <code>IPackedAuto</code> มีขนาด 8 bytes ด้วย
              manual packing ทั้งแปดตัวพอดีในหนึ่ง byte:
            </p>
          </div>

          <CodeBlock
            filename="StatusFlags.cs"
            language="csharp"
            code={statusFlagsCode}
          />

          <Callout type="tip" title="ใช้ IPackedAuto สำหรับ structs ที่เรียบง่าย">
            เว้นแต่คุณมีความต้องการ bandwidth เฉพาะ เริ่มต้นด้วย <code>IPackedAuto</code> ไม่
            ต้องการ boilerplate และจัดการ primitive types ทั้งหมด, <code>Vector3</code>,{" "}
            <code>Quaternion</code>, <code>string</code> และ enums โดยอัตโนมัติ ย้ายไปยัง{" "}
            <code>IPacked</code> เฉพาะเมื่อ profiling แสดงว่า struct อยู่บน hot send path
          </Callout>

          <Callout type="warning" title="การเปลี่ยน struct layout ทำให้ compatibility เสีย">
            ถ้าคุณเปลี่ยนลำดับ field หรือเพิ่ม/ลบ fields บน <code>IPackedAuto</code> struct clients
            เก่า จะอ่านข้อมูลผิดและอาจ crash เมื่อส่ง updates ตั้ง version ให้กับ packets ของคุณ:
            เพิ่ม version field ที่หน้า หรือใช้ type name ใหม่ เพื่อรักษา backward compatibility
            ระหว่าง rolling deploys
          </Callout>
        </DocPage>
      }
    />
  );
}
