import { useRef, useEffect, useState, FC, useContext } from 'react';
import './MapFrame.scss';
import { type Map } from "maplibre-gl"
import { AnswerValidator } from '../../utils/answerValidator';
import { MapContext, useData } from '../..';
import { fetchBrouterGeoJson } from './brouter';

export const MapFrame: FC<{
  validator: AnswerValidator
}> = ({ validator }) => {
  const { stations, routes, shapes } = useData();
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<Map | null>(null);

  const initialMapSettings = useContext(MapContext);
  const [lng, setLng] = useState(initialMapSettings.longitude);
  const [lat, setLat] = useState(initialMapSettings.latitude);
  const [zoom, setZoom] = useState(initialMapSettings.zoom);
  const solution = validator.todaysSolution;

  const stops = [
    solution.origin,
    solution.first_transfer_arrival,
    solution.first_transfer_departure,
    solution.second_transfer_arrival,
    solution.second_transfer_departure,
    solution.destination
  ];

  const stopsGeoJson = () => {
    return {
      "type": "FeatureCollection",
      "features": [...new Set(stops)].map((stopId) => {
        const station = stations[stopId];
        return {
          "type": "Feature",
          "properties": {
            "id": stopId,
            "name": `${station.name}`,
          },
          "geometry": {
            "type": "Point",
            "coordinates": [station.longitude, station.latitude]
          }
        }
      })
    };
  }

  const lineGeoJson = (line: any) => {
    const route = routes[line.route];
    let shape;
    let internalRoute = line.route;

    const beginCoord = [stations[line.begin].stops[internalRoute].latitude, stations[line.begin].stops[internalRoute].longitude];
    const endCoord = [stations[line.end].stops[internalRoute].latitude, stations[line.end].stops[internalRoute].longitude];

    let coordinates: [number, number][] = [];

    shape = shapes[internalRoute];

    console.debug(internalRoute);
    console.debug(shape);

    console.debug(beginCoord, endCoord);

    const beginIndex = shape.findIndex((coord: [number, number]) => coord[0] === beginCoord[0] && coord[1] === beginCoord[1]);
    const endIndex = shape.findIndex((coord: [number, number]) => coord[0] === endCoord[0] && coord[1] === endCoord[1]);

    console.debug(beginIndex);
    console.debug(endIndex);

    if (beginIndex < endIndex) {
      coordinates = shape.slice(beginIndex, endIndex + 1);
    } else {
      coordinates = shape.slice(endIndex, beginIndex + 1);
    }

    for (let coordinate of coordinates) {
      let temp = coordinate[0];
      coordinate[0] = coordinate[1];
      coordinate[1] = temp;
    }

    const geoJson = {
      "type": "Feature",
      "properties": {
        "color": route.color,
      },
      "geometry": {
        "type": "LineString",
        "coordinates": coordinates
      }
    } as const;

    return geoJson;
  };

  useEffect(() => {
    if (map.current) return; // initialize map only once
    import("maplibre-gl")
      .then(({ Map }) => {
        map.current = new Map({
          container: mapContainer.current!!,
          style: 'https://tiles.versatiles.org/assets/styles/colorful.json',
          center: [lng, lat],
          minZoom: 1,
          zoom: zoom,
          maxPitch: 0,
        });
        map.current.dragRotate.disable();
        map.current.touchZoomRotate.disableRotation();

        map.current.on('load', async () => {
          if (!map.current) {
            return;
          }
          map.current.resize();
          const trip = validator.todaysTrip;
          const solution = validator.todaysSolution;
          const image = await map.current.loadImage("ic--twotone-circle.png");
          map.current.addImage("custom-marker", image.data);

          const lines = [{
            route: trip[0],
            begin: solution.origin,
            end: solution.first_transfer_arrival,
          },
          {
            route: trip[1],
            begin: solution.first_transfer_departure,
            end: solution.second_transfer_arrival,
          },
          {
            route: trip[2],
            begin: solution.second_transfer_departure,
            end: solution.destination,
          }];

          const getCoords = (stopId: string) => ({ latitude: stations[stopId].latitude, longitude: stations[stopId].longitude });
          let lineJson;
          try {
            lineJson = await fetchBrouterGeoJson(lines.map(line => [getCoords(line.begin), getCoords(line.end)]));
          } catch (error) {
            console.error("Failed to retrieve routing from brouter.");
            lineJson = lines.map(line => lineGeoJson(line));
          }

          lines.forEach((line, index) => {
            const layerId = `line-${line.route}-${line.begin}-${line.end}`;
            lineJson[index].features[0].properties.color = routes[line.route].color;
            map.current!!.addSource(layerId, {
              "type": "geojson",
              "data": lineJson[index],
            });
            map.current!!.addLayer({
              "id": layerId,
              "type": "line",
              "source": layerId,
              "layout": {
                "line-join": "miter",
                "line-cap": "round",
              },
              "paint": {
                "line-width": 2.5,
                "line-color": ["get", "color"],
              }
            });
          });
          const stopsJson = stopsGeoJson();
          map.current.addSource("Stops", {
            "type": "geojson",
            // @ts-expect-error
            "data": stopsJson
          });
          map.current.addLayer({
            "id": "Stops",
            "type": "symbol",
            "source": "Stops",
            "layout": {
              "text-field": ['get', 'name'],
              "text-size": 12,
              "text-font": ["noto_sans_regular"],
              "text-optional": false,
              "text-justify": "auto",
              'text-allow-overlap': false,
              "text-padding": 1,
              "text-variable-anchor": ["bottom-right", "top-right", "bottom-left", "top-left", "right", "left", "bottom"],
              "text-radial-offset": 0.5,
              "icon-image": "custom-marker",
              "icon-size": 4 / 13,
              "icon-allow-overlap": true,
            },
            "paint": {
              "text-color": '#000000',
            },
          });
        });
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!map.current) return; // wait for map to initialize
    map.current.on('move', () => {
      if (!map.current) {
        return;
      }
      setLng(Number(map.current.getCenter().lng.toFixed(4)));
      setLat(Number(map.current.getCenter().lat.toFixed(4)));
      setZoom(Number(map.current.getZoom().toFixed(2)));
    });
  }, [map]);

  return (
    <div>
      <div ref={mapContainer} className="map-container" />
    </div>
  );
}
