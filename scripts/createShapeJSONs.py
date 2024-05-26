#!/usr/bin/python
import json, csv, glob, os
stations = []

with open("./scripts/data/stations.csv", newline="") as csvfile:
    reader = csv.reader(csvfile)

    for line in reader:
        stations.append(line)

def getStationById(id):
    for station in stations:
        if station[0] == str(id):
            return station

for filename in glob.glob("./scripts/data/stops/*.csv"):
    with open(filename) as stopFile:
        jsonArray = []
        stops = stopFile.read().split("\n")

    for stop in stops:
        if stop == "":
            continue
        station = getStationById(stop)
        jsonArray.append([float(station[2]), float(station[3])])

    with open(f"./scripts/data/shapes/{os.path.basename(filename).replace(".csv", ".json")}", "w") as outFile:
        outFile.write(json.dumps(jsonArray, indent=4))
