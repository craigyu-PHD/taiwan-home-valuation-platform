import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { parse } from "csv-parse";

const DOWNLOAD_URL = "https://plvr.land.moi.gov.tw/Download?type=zip&fileName=lvr_landcsv.zip";
const outputDir = path.resolve("public/data");
const zipPath = path.join(outputDir, "moi-source.zip");
const outputJson = path.join(outputDir, "moi-current-sample.json");

const CITY_PREFIX = {
  a: "臺北市",
  b: "臺中市",
  c: "基隆市",
  d: "臺南市",
  e: "高雄市",
  f: "新北市",
  g: "宜蘭縣",
  h: "桃園市",
  i: "嘉義市",
  j: "新竹縣",
  k: "苗栗縣",
  m: "南投縣",
  n: "彰化縣",
  o: "新竹市",
  p: "雲林縣",
  q: "嘉義縣",
  t: "屏東縣",
  u: "花蓮縣",
  v: "臺東縣",
  w: "金門縣",
  x: "澎湖縣",
  z: "連江縣",
};

const propertyTypeFromBuildingState = (value = "") => {
  if (value.includes("住宅大樓")) return "住宅大樓";
  if (value.includes("華廈")) return "華廈";
  if (value.includes("公寓")) return "公寓";
  if (value.includes("套房")) return "套房";
  if (value.includes("透天")) return "透天";
  if (value.includes("店面")) return "店面";
  if (value.includes("辦公")) return "辦公室";
  if (value.includes("廠")) return "廠房";
  if (value.includes("農舍")) return "農舍";
  return "其他";
};

const hasSpecialTransactionNote = (value = "") =>
  [
    "親友",
    "特殊關係",
    "急買急賣",
    "地上權",
    "法拍",
    "毛胚",
    "陽台外推",
    "夾層",
    "增建",
    "瑕疵",
    "包含公共設施保留地",
  ].some((keyword) => value.includes(keyword));

const ping = (sqm) => Number(sqm || 0) * 0.3025;

const rocDateToIso = (value = "") => {
  const padded = value.padStart(7, "0");
  const year = Number(padded.slice(0, 3)) + 1911;
  const month = padded.slice(3, 5);
  const day = padded.slice(5, 7);
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
};

const parseFloor = (value = "") => {
  const numerals = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  if (!value) return 0;
  const match = value.match(/\d+/);
  if (match) return Number(match[0]);
  if (value.includes("十")) {
    const [tens, ones] = value.split("十");
    return (tens ? numerals[tens] ?? 1 : 1) * 10 + (ones ? numerals[ones] ?? 0 : 0);
  }
  return numerals[value[0]] ?? 0;
};

const fetchZip = async () => {
  await fs.mkdir(outputDir, { recursive: true });
  const response = await fetch(DOWNLOAD_URL, {
    headers: {
      "User-Agent": "TaiwanHomeValuationPrototype/0.1 (+local development)",
    },
  });
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(zipPath, buffer);
  return buffer.length;
};

const runUnzip = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn("unzip", args);
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `unzip exited with ${code}`));
    });
  });
const listZipEntries = async () => {
  const stdout = await runUnzip(["-Z1", zipPath]);
  return stdout.split("\n").filter((name) => /^[a-z]_lvr_land_a\.csv$/.test(name));
};

const streamZipEntry = async (entryName) => {
  const child = spawn("unzip", ["-p", zipPath, entryName]);
  child.on("error", (error) => {
    throw error;
  });
  return child.stdout;
};

const parseEntry = async (entryName, limitPerCity = 120) => {
  const source = await streamZipEntry(entryName);
  const parser = source.pipe(
    parse({
      columns: true,
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
    }),
  );
  const city = CITY_PREFIX[entryName[0]] ?? "";
  const rows = [];
  for await (const record of parser) {
    if (record["交易標的"]?.includes("土地")) continue;
    if (!record["建物移轉總面積平方公尺"] || Number(record["總價元"]) <= 0) continue;
    if (hasSpecialTransactionNote(record["備註"])) continue;
    const propertyType = propertyTypeFromBuildingState(record["建物型態"]);
    if (!["住宅大樓", "華廈", "公寓", "套房"].includes(propertyType)) continue;
    const areaPing = ping(record["建物移轉總面積平方公尺"]);
    const totalPriceWan = Number(record["總價元"]) / 10000;
    if (!areaPing || !totalPriceWan) continue;
    rows.push({
      id: record["編號"],
      source: "MOI_OPEN_DATA",
      sourceLabel: "內政部不動產成交案件實際資訊 Open Data",
      sourceUrl: "https://plvr.land.moi.gov.tw/DownloadOpenData",
      dataVersion: new Date().toISOString().slice(0, 10),
      city,
      district: record["鄉鎮市區"],
      road: "",
      addressLabel: record["土地位置建物門牌"],
      lat: null,
      lng: null,
      propertyType,
      areaPing: Number(areaPing.toFixed(2)),
      floor: parseFloor(record["移轉層次"]),
      totalFloors: parseFloor(record["總樓層數"]),
      ageYears: 0,
      hasParking: Boolean(record["車位類別"]),
      parkingType: record["車位類別"] || "無",
      transactionDate: rocDateToIso(record["交易年月日"]),
      totalPriceWan: Number(totalPriceWan.toFixed(0)),
      unitPriceWan: Number((totalPriceWan / areaPing).toFixed(1)),
      note: record["備註"],
    });
    if (rows.length >= limitPerCity) break;
  }
  return rows;
};

const main = async () => {
  const bytes = await fetchZip();
  const entries = await listZipEntries();
  if (!entries.length) {
    throw new Error("No buy/sell CSV entries found in downloaded archive.");
  }
  const batches = [];
  for (const entry of entries) {
    batches.push(...(await parseEntry(entry)));
  }
  await fs.writeFile(
    outputJson,
    JSON.stringify(
      {
        source: DOWNLOAD_URL,
        downloadedAt: new Date().toISOString(),
        bytes,
        note: "Rows do not include coordinates. Production must geocode/cache locations or join authorized coordinate data before map distance valuation.",
        rows: batches,
      },
      null,
      2,
    ),
  );
  console.log(`Wrote ${batches.length} normalized records to ${outputJson}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
