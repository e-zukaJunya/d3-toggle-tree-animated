import "base.scss";
import "core-js/stable";
import "regenerator-runtime/runtime";
import "ress";
import * as d3 from "d3";

// 描画する四角（ノード）のサイズ
const rectSize = {
  height: 20,
  width: 80,
};

// ノード間のスペースなど
const basicSpace = {
  padding: 30,
  height: 50,
  width: 120,
};

// モックデータ
const sampleData = {
  name: "1-A",
  children: [
    { name: "2-A" },
    {
      name: "2-B",
      children: [
        { name: "3-A" },
        {
          name: "3-B",
          children: [{ name: "4-A" }, { name: "4-B" }, { name: "4-C" }],
        },
        { name: "3-C" },
      ],
    },
    { name: "2-C" },
    {
      name: "2-D",
      children: [{ name: "3-D" }, { name: "3-E" }],
    },
    { name: "2-E" },
  ],
};

// ツリー用データ設定
const root = d3.hierarchy(sampleData);
const tree = d3.tree();
// treeレイアウトのためのx, y座標をデータに付与してくれる
tree(root);
// それぞれのノードが持つ末端ノードの数を算出して、"value"というキー名でノードのデータに付与
root.count();
// console.log(root);

// #region 全体svg要素の高さと幅を計算し生成
// 末端ノードの数 * ノードの高さ + (末端ノードの数 - 1) * (ノードの基準点どうしの縦幅 - ノードの高さ) + 上下の余白
const height =
  root.value * rectSize.height +
  (root.value - 1) * (basicSpace.height - rectSize.height) +
  basicSpace.padding * 2;
// (rootの高さ + 1) * ノードの幅 + rootの高さ * (ノードの基準点どうしの横幅 - ノードの幅) + 上下の余白
// 最終的に90度回転した状態になるためrootの存在する高さで横幅を計算する
const width =
  (root.height + 1) * rectSize.width +
  root.height * (basicSpace.width - rectSize.width) +
  basicSpace.padding * 2;
const svg = d3.select("body").append("svg").attr("width", width).attr("height", height);
// #endregion

// 渡されたnameを含む階層階層を探索（同じparentの）
const seekParent = (currentData, name) => {
  // 今処理しているノードの親の子たちを取得することでその階層のデータを取得
  const crntHrcy = currentData.parent.children;
  // 取得した階層に、今探しているnameを含むものがいれば、それが目的の階層
  const target = crntHrcy.find((contents) => contents.data.name == name);
  // 見つかればその階層をnameとセットで返却
  // 見つからなければ親を渡して再帰処理させることで一つ上の階層を探索させる
  return target ? { name: name, hierarchy: crntHrcy } : seekParent(currentData.parent, name);
};

// 自分より上にいる末端ノードの数を配列として取り出す
const calcLeaves = (names, currentData) => {
  // 親の含まれる階層をそれぞれ抽出する（nameと階層のJSONで）
  const eachHierarchies = names.map((name) => seekParent(currentData, name));
  // それぞれの階層における、そのnameの位置（インデックス）を取得
  const eachIdxes = eachHierarchies.map((item) =>
    item.hierarchy.findIndex((contents) => contents.data.name == item.name)
  );
  // 先ほど取得したインデックスを使って、それぞれの階層をスライスする
  const filteredHierarchies = eachHierarchies.map((item, idx) =>
    item.hierarchy.slice(0, eachIdxes[idx])
  );
  // それぞれの階層に含まれるvalueを抽出
  const values = filteredHierarchies.map((hierarchy) => hierarchy.map((item) => item.value));
  // 平坦化して返却
  return values.flat();
};

// y座標の計算
const defineY = (data, spaceInfo) => {
  // 親をたどる配列からバインドされたデータを抽出
  const ancestorValues = data.ancestors().map((item) => item.data.name);
  // 自分より上にいる末端ノードの数を配列として取り出す
  const leaves = calcLeaves(ancestorValues.slice(0, ancestorValues.length - 1), data);
  // ノードの数を合計
  const sumLeaves = leaves.reduce((previous, current) => previous + current, 0);
  // y座標を計算 末端ノードの数 * ノードの基準点同士の縦幅 + 上の余白
  return sumLeaves * spaceInfo.height + spaceInfo.padding;
};

// 位置決め
const definePos = (treeData, spaceInfo) => {
  treeData.each((d) => {
    // x座標は 深さ * ノード間の幅 + 左側の余白
    d.x = d.depth * spaceInfo.width + spaceInfo.padding;
    d.y = defineY(d, spaceInfo);
  });
};
definePos(root, basicSpace);

// 全体をグループ化
const g = svg.append("g");

// path要素の追加
g.selectAll(".link")
  .data(root.descendants().slice(1))
  .enter()
  .append("path")
  .attr("class", "link")
  .attr("fill", "none")
  .attr("stroke", "black")
  .attr("d", (d) =>
    `M${d.x},${d.y}
    L${d.parent.x + rectSize.width + (basicSpace.width - rectSize.width) / 2},${d.y}
    ${d.parent.x + rectSize.width + (basicSpace.width - rectSize.width) / 2},${d.parent.y}
    ${d.parent.x + rectSize.width},${d.parent.y}`
      .replace(/\r?\n/g, "")
      .replace(/\s+/g, " ")
  )
  .attr("transform", (d) => `translate(0, ${rectSize.height / 2})`);

// 各ノード用グループの作成
const node = g
  .selectAll(".node")
  .data(root.descendants())
  .enter()
  .append("g")
  .attr("class", "node")
  .attr("transform", (d) => `translate(${d.x}, ${d.y})`);

// 四角
node
  .append("rect")
  .attr("width", rectSize.width)
  .attr("height", rectSize.height)
  .attr("fill", "#fff")
  .attr("stroke", "black");

// テキスト
node
  .append("text")
  .text((d) => d.data.name)
  .attr("transform", `translate(5, 15)`);
