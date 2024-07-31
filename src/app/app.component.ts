import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  center: google.maps.LatLngLiteral = { lat: 41.8721, lng: -87.7878 };
  zoom = 18;
  map?: google.maps.Map;
  distance: number = 50; // Example distance in meters
  altitude: number = 3;
  polygon?: google.maps.Polygon;
  waypoints: google.maps.Marker[] = [];
  selectedMarker: google.maps.Marker | null = null;
  selectedMarkerType: string = 'waypoint';
  selectedMarkerAltitude: number = 0;
  selectedMarkerAirSpeed: number = 0;
  markerProperties: Map<google.maps.Marker, { type: string, altitude: number, airSpeed: number }> = new Map();


  onMapInitialized(map: google.maps.Map) {
    this.map = map;
    this.initializeDrawingManager();

    this.map.addListener('click', (event: google.maps.MapMouseEvent) => {
      this.addManualPoint(event.latLng!);
    });
  }

  initializeDrawingManager() {
    const drawingManager = new google.maps.drawing.DrawingManager({
      drawingMode: google.maps.drawing.OverlayType.POLYGON,
      drawingControl: true,
      drawingControlOptions: {
        position: google.maps.ControlPosition.TOP_CENTER,
        drawingModes: [google.maps.drawing.OverlayType.POLYGON],
      },
      polygonOptions: {
        editable: true,
        draggable: true,
      },
    });

    drawingManager.setMap(this.map!);

    google.maps.event.addListener(drawingManager, 'overlaycomplete', (event: google.maps.drawing.OverlayCompleteEvent) => {
      if (event.type === google.maps.drawing.OverlayType.POLYGON) {
        if (this.polygon) {
          this.polygon.setMap(null);
        }
        this.polygon = event.overlay as google.maps.Polygon;
        const path = this.polygon.getPath();
        const coordinates: { lat: number; lng: number }[] = [];
        for (let i = 0; i < path.getLength(); i++) {
          coordinates.push({
            lat: path.getAt(i).lat(),
            lng: path.getAt(i).lng(),
          });
        }
        console.log(coordinates);
        // Save or process coordinates
      }
    });
  }

  generateWaypoints() {
    if (!this.polygon) {
      alert('Please draw a polygon first.');
      return;
    }

    const path = this.polygon.getPath();
    const coordinates: google.maps.LatLng[] = [];
    for (let i = 0; i < path.getLength(); i++) {
      coordinates.push(path.getAt(i));
    }

    console.log('Generating waypoints with distance:', this.distance, 'and altitude:', this.altitude);

    this.clearWaypoints();
    this.createSpiralWaypoints(coordinates);
  }

  createSpiralWaypoints(polygonCoords: google.maps.LatLng[]) {
    const bounds = new google.maps.LatLngBounds();
    polygonCoords.forEach(coord => bounds.extend(coord));

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    let top = ne.lat();
    let bottom = sw.lat();
    let left = sw.lng();
    let right = ne.lng();

    const waypoints: google.maps.LatLng[] = [];
    const distanceLat = this.distance / 111320;
    let lat = top;
    let lng = left;
    let direction = 1; // 1 for clockwise, -1 for counterclockwise

    while (top > bottom && left < right) {
      // Top edge
      for (lng = left; lng <= right; lng += this.distance / (111320 * Math.cos(lat * (Math.PI / 180)))) {
        const point = new google.maps.LatLng(top, lng);
        if (google.maps.geometry.poly.containsLocation(point, this.polygon!)) {
          waypoints.push(point);
          this.addWaypoint(point);
        }
      }
      top -= distanceLat;

      // Right edge
      lat = top;
      for (lat = top; lat >= bottom; lat -= distanceLat) {
        const point = new google.maps.LatLng(lat, right);
        if (google.maps.geometry.poly.containsLocation(point, this.polygon!)) {
          waypoints.push(point);
          this.addWaypoint(point);
        }
      }
      right -= this.distance / (111320 * Math.cos(lat * (Math.PI / 180)));

      // Bottom edge
      lng = right;
      for (lng = right; lng >= left; lng -= this.distance / (111320 * Math.cos(lat * (Math.PI / 180)))) {
        const point = new google.maps.LatLng(bottom, lng);
        if (google.maps.geometry.poly.containsLocation(point, this.polygon!)) {
          waypoints.push(point);
          this.addWaypoint(point);
        }
      }
      bottom += distanceLat;

      // Left edge
      lat = bottom;
      for (lat = bottom; lat <= top; lat += distanceLat) {
        const point = new google.maps.LatLng(lat, left);
        if (google.maps.geometry.poly.containsLocation(point, this.polygon!)) {
          waypoints.push(point);
          this.addWaypoint(point);
        }
      }
      left += this.distance / (111320 * Math.cos(lat * (Math.PI / 180)));
    }

    waypoints.forEach((point, index) => {
      if (index < waypoints.length - 1) {
        this.drawLine(point, waypoints[index + 1]);
      }
    });
  }

  drawLine(startPoint: google.maps.LatLng, endPoint: google.maps.LatLng) {
    const line = new google.maps.Polyline({
      path: [startPoint, endPoint],
      geodesic: true,
      strokeColor: '#FF0000',
      strokeOpacity: 1.0,
      strokeWeight: 2,
      map: this.map!
    });
  }
  // Update the addWaypoint method to include a click listener for selecting a marker
  addWaypoint(location: google.maps.LatLng) {
    const marker = new google.maps.Marker({
      position: location,
      map: this.map!,
      title: `Waypoint`,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 4,
        fillColor: '#00F',
        fillOpacity: 1,
        strokeWeight: 1,
        strokeColor: '#00F'
      }
    });

    marker.addListener('click', () => {
      this.selectMarker(marker);
    });

    this.waypoints.push(marker);
    this.markerProperties.set(marker, { type: 'waypoint', altitude: this.altitude, airSpeed: 0 });
  }

  // Add the selectMarker method
  selectMarker(marker: google.maps.Marker) {
    this.selectedMarker = marker;
    const properties = this.markerProperties.get(marker);
    if (properties) {
      this.selectedMarkerType = properties.type;
      this.selectedMarkerAltitude = properties.altitude;
      this.selectedMarkerAirSpeed = properties.airSpeed;
    }
  }

  // Add the updateMarkerProperties method
  updateMarkerProperties() {
    if (this.selectedMarker) {
      const properties = this.markerProperties.get(this.selectedMarker);
      if (properties) {
        properties.type = this.selectedMarkerType;
        properties.altitude = this.selectedMarkerAltitude;
        properties.airSpeed = this.selectedMarkerAirSpeed;
      }
    }
  }

  clearWaypoints() {
    this.waypoints.forEach(marker => marker.setMap(null));
    this.waypoints = [];
  }

  addManualPoint(location: google.maps.LatLng) {
    console.log('Manual point added:', location.toString());
    this.addWaypoint(location);
  }



  generateXML() {
    const xmlDocument = document.implementation.createDocument(null, "mission", null);

    const versionElement = xmlDocument.createElement("version");
    versionElement.setAttribute("value", "2.3-pre8");
    xmlDocument.documentElement.appendChild(versionElement);

    const mwpElement = xmlDocument.createElement("mwp");
    mwpElement.setAttribute("cx", this.center.lng.toString());
    mwpElement.setAttribute("cy", this.center.lat.toString());
    mwpElement.setAttribute("home-x", "0");
    mwpElement.setAttribute("home-y", "0");
    mwpElement.setAttribute("zoom", this.zoom.toString());
    xmlDocument.documentElement.appendChild(mwpElement);

    let missionItemNumber = 1;
    this.waypoints.forEach((marker) => {
      const properties = this.markerProperties.get(marker);
      if (properties) {
        const missionItemElement = xmlDocument.createElement("missionitem");
        missionItemElement.setAttribute("no", missionItemNumber.toString());
        missionItemElement.setAttribute("action", properties.type.toUpperCase().replace("-", "_"));
        missionItemElement.setAttribute("lat", marker.getPosition()!.lat().toString());
        missionItemElement.setAttribute("lon", marker.getPosition()!.lng().toString());
        missionItemElement.setAttribute("alt", properties.altitude.toString());
        missionItemElement.setAttribute("parameter1", "0");
        missionItemElement.setAttribute("parameter2", "0");
        missionItemElement.setAttribute("parameter3", "0");
        missionItemElement.setAttribute("flag", properties.type === "landing" ? "165" : "0");
        xmlDocument.documentElement.appendChild(missionItemElement);
        missionItemNumber++;
      }
    });

    const xmlString = new XMLSerializer().serializeToString(xmlDocument);
    this.downloadXML(xmlString);
  }

  downloadXML(xmlString: string) {
    const blob = new Blob([xmlString], { type: 'application/xml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mission.xml';
    a.click();
    window.URL.revokeObjectURL(url);
  }

}
