import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'maplibre-gl';

import { todaysTrip, todaysSolution } from '../utils/answerValidations';

import stations from "../data/stations.json";
import routes from "../data/routes.json";
import shapes from "../data/shapes.json";

import './MapFrame.scss';

const MapFrame = (props) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(6.9602494028380315);
  const [lat, setLat] = useState(50.935732371452474);
  const [zoom, setZoom] = useState(10.58);
  const solution = todaysSolution();

  const stopsGeoJson = () => {
    const stops = [
      solution.origin,
      solution.first_transfer_arrival,
      solution.first_transfer_departure,
      solution.second_transfer_arrival,
      solution.second_transfer_departure,
      solution.destination
    ];
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

  const lineGeoJson = (line) => {
    const route = routes[line.route];
    let shape;
    let internalRoute = line.route;

    const beginCoord = [stations[line.begin].stops[internalRoute].latitude, stations[line.begin].stops[internalRoute].longitude];
    const endCoord = [stations[line.end].stops[internalRoute].latitude, stations[line.end].stops[internalRoute].longitude];

    let coordinates = [];

    shape = shapes[internalRoute];

    console.debug(internalRoute);
    console.debug(shape);

    console.debug(beginCoord, endCoord);

    const beginIndex = shape.findIndex((coord) => coord[0] === beginCoord[0] && coord[1] === beginCoord[1]);
    const endIndex = shape.findIndex((coord) => coord[0] === endCoord[0] && coord[1] === endCoord[1]);

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

    return {
      "type": "Feature",
      "properties": {
        "color": route.color,
      },
      "geometry": {
        "type": "LineString",
        "coordinates": coordinates
      }
    }
  }

  useEffect(() => {
    if (map.current) return; // initialize map only once
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'https://tiles.versatiles.org/assets/styles/colorful.json',
      center: [lng, lat],
      minZoom: 1,
      zoom: zoom,
      maxPitch: 0,
    });
    map.current.dragRotate.disable();
    map.current.touchZoomRotate.disableRotation();

    map.current.on('load', async () => {
      map.current.resize();
      const trip = todaysTrip();
      const solution = todaysSolution();
      const image = await map.current.loadImage("ic--twotone-circle.png");
      map.current.addImage("custom-marker", image.data);
      let coordinates = [];
      [
        {
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
        },
      ].forEach((line, i) => {
        const lineJson = lineGeoJson(line);
        coordinates = coordinates.concat(lineJson.geometry.coordinates);
        const layerId = `line-${i}`;
        map.current.addSource(layerId, {
          "type": "geojson",
          "data": lineJson
        });
        map.current.addLayer({
          "id": layerId,
          "type": "line",
          "source": layerId,
          "layout": {
            "line-join": "miter",
            "line-cap": "round",
          },
          "paint": {
            "line-width": 2,
            "line-color": ["get", "color"],
          }
        });
      });
      const stopsJson = stopsGeoJson();
      map.current.addSource("Stops", {
        "type": "geojson",
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
          "icon-size": 4/13,
          "icon-allow-overlap": true,
        },
        "paint": {
          "text-color": '#000000',
        },
      });
    });
  });

  useEffect(() => {
    if (!map.current) return; // wait for map to initialize
    map.current.on('move', () => {
      setLng(map.current.getCenter().lng.toFixed(4));
      setLat(map.current.getCenter().lat.toFixed(4));
      setZoom(map.current.getZoom().toFixed(2));
    });
  });

  return (
    <div>
      <div ref={mapContainer} className="map-container" />
    </div>
  );
}

export default MapFrame;
