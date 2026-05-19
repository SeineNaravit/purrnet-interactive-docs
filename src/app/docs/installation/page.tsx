import { DocPage } from "@/components/docs/DocPage";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { Callout } from "@/components/docs/Callout";
import { BilingualContent } from "@/components/docs/BilingualContent";

export const metadata = { title: "Installation" };

const stableUrl = `https://github.com/PurrNet/PurrNet.git?path=/Assets/PurrNet#release`;
const devUrl = `https://github.com/PurrNet/PurrNet.git?path=/Assets/PurrNet#dev`;

export default function Page() {
  return (
    <BilingualContent
      en={
        <DocPage title="Installation" description="Three ways to add PurrNet to your Unity project." href="/docs/installation">
          <div className="prose">
            <h2>Method 1: Git URL (Recommended)</h2>
            <p>In Unity: <strong>Window → Package Manager → + → Add package from git URL</strong></p>
          </div>
          <CodeBlock language="text" filename="Stable release" code={stableUrl} />
          <CodeBlock language="text" filename="Dev branch (latest features)" code={devUrl} />
          <Callout type="tip" title="Git required">Restart Unity and Unity Hub after installing Git if the URL does not work.</Callout>
          <div className="prose">
            <h2>Method 2: Unity Asset Store</h2>
            <p>Search for "PurrNet" in the Unity Asset Store and click <strong>Add to My Assets</strong>, then import it from the Package Manager.</p>
            <h2>Method 3: Manual download</h2>
            <p>Download the latest <code>.unitypackage</code> from the <a href="https://github.com/PurrNet/PurrNet/releases" target="_blank" rel="noreferrer">GitHub Releases</a> page and double-click to import.</p>
            <h2>After installation</h2>
            <ul>
              <li>A <strong>PurrNet</strong> menu will appear in the Unity toolbar.</li>
              <li>Head to <a href="/docs/minimal-setup">Minimal Setup</a> to build your first networked scene.</li>
            </ul>
          </div>
        </DocPage>
      }
      th={
        <DocPage title="การติดตั้ง" description="สามวิธีในการเพิ่ม PurrNet ไปยังโครงการ Unity ของคุณ" href="/docs/installation">
          <div className="prose">
            <h2>วิธีที่ 1: Git URL (แนะนำ)</h2>
            <p>ใน Unity: <strong>Window → Package Manager → + → Add package from git URL</strong></p>
          </div>
          <CodeBlock language="text" filename="Stable release" code={stableUrl} />
          <CodeBlock language="text" filename="Dev branch (ฟีเจอร์ล่าสุด)" code={devUrl} />
          <Callout type="tip" title="ต้องติดตั้ง Git">รีสตาร์ท Unity และ Unity Hub หลังจากติดตั้ง Git หาก URL ไม่ทำงาน</Callout>
          <div className="prose">
            <h2>วิธีที่ 2: Unity Asset Store</h2>
            <p>ค้นหา "PurrNet" ใน Unity Asset Store และคลิก <strong>Add to My Assets</strong> แล้ว import จาก Package Manager</p>
            <h2>วิธีที่ 3: ดาวน์โหลดด้วยตนเอง</h2>
            <p>ดาวน์โหลด <code>.unitypackage</code> ล่าสุดจากหน้า <a href="https://github.com/PurrNet/PurrNet/releases" target="_blank" rel="noreferrer">GitHub Releases</a> และดับเบิลคลิกเพื่อ import</p>
            <h2>หลังการติดตั้ง</h2>
            <ul>
              <li>เมนู <strong>PurrNet</strong> จะปรากฏใน Unity toolbar</li>
              <li>ไปที่ <a href="/docs/minimal-setup">การตั้งค่าขั้นต่ำ</a> เพื่อสร้าง networked scene แรกของคุณ</li>
            </ul>
          </div>
        </DocPage>
      }
    />
  );
}
