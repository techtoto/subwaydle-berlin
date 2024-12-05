export type Coords = {
  latitude: number;
  longitude: number;
};

const brouterUrl = new URL("https://brouter.de/brouter");

export async function fetchBrouterGeoJson(connections: [Coords, Coords][]) {
  return await Promise.all(connections.map(([start, end]) => fetchBrouterConnection(start, end)));
}

async function fetchBrouterConnection(start: Coords, end: Coords) {
  const url = new URL(brouterUrl);
  url.searchParams.set(
    "lonlats",
    `${start.longitude},${start.latitude}|${end.longitude},${end.latitude}`,
  );
  url.searchParams.set("profile", "rail");
  url.searchParams.set("format", "geojson");
  url.searchParams.set("alternativeidx", "0");

  try {
    const geojson = await fetch(url).then((res) => res.json());
    return geojson;
  } catch (error) {
    console.error("Failed to fetch brouter json.", error);
    return null;
  }
}
