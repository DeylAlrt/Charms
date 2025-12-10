import path from "path";
import fs from "fs";
import CharmEditorClient from "../components/CharmEditorClient";

export const revalidate = 0;

export default function Page() {
  const charmsDir = path.join(process.cwd(), "public", "charms");
  let charmFiles: string[] = [];

  try {
    const entries = fs.readdirSync(charmsDir, { withFileTypes: true });
    charmFiles = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((n) => /\.(png|jpe?g|webp|svg|gif)$/i.test(n));
  } catch (err) {
    charmFiles = [];
  }

  return <CharmEditorClient charmFiles={charmFiles} />;
}
