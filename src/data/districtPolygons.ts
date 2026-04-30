export type LatLngTuple = [number, number];

interface DistrictShape {
  city: string;
  district: string;
  center: LatLngTuple;
  polygon: LatLngTuple[];
}

const districtShapes: DistrictShape[] = [
  {
    city: "臺北市",
    district: "信義區",
    center: [25.0338, 121.565],
    polygon: [
      [25.048, 121.548],
      [25.049, 121.587],
      [25.019, 121.592],
      [25.018, 121.555],
    ],
  },
  {
    city: "臺北市",
    district: "大安區",
    center: [25.0325, 121.543],
    polygon: [
      [25.047, 121.526],
      [25.047, 121.562],
      [25.012, 121.563],
      [25.013, 121.528],
    ],
  },
  {
    city: "新北市",
    district: "板橋區",
    center: [25.014, 121.463],
    polygon: [
      [25.035, 121.437],
      [25.034, 121.492],
      [24.987, 121.491],
      [24.988, 121.438],
    ],
  },
  {
    city: "臺中市",
    district: "西屯區",
    center: [24.168, 120.642],
    polygon: [
      [24.205, 120.604],
      [24.204, 120.677],
      [24.135, 120.678],
      [24.136, 120.608],
    ],
  },
  {
    city: "高雄市",
    district: "鼓山區",
    center: [22.654, 120.287],
    polygon: [
      [22.681, 120.257],
      [22.681, 120.312],
      [22.626, 120.313],
      [22.626, 120.263],
    ],
  },
  {
    city: "臺南市",
    district: "東區",
    center: [22.981, 120.226],
    polygon: [
      [23.005, 120.203],
      [23.004, 120.25],
      [22.958, 120.251],
      [22.958, 120.204],
    ],
  },
  {
    city: "新竹市",
    district: "東區",
    center: [24.792, 121.012],
    polygon: [
      [24.82, 120.982],
      [24.82, 121.048],
      [24.758, 121.049],
      [24.758, 120.983],
    ],
  },
  {
    city: "花蓮縣",
    district: "花蓮市",
    center: [23.991, 121.603],
    polygon: [
      [24.014, 121.576],
      [24.014, 121.631],
      [23.966, 121.632],
      [23.966, 121.578],
    ],
  },
];

export const getDistrictShape = (city?: string, district?: string) =>
  districtShapes.find((shape) => shape.city === city && shape.district === district);
