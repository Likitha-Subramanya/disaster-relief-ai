import MapView from '../components/MapView'

export default function MapPage() {
  return (
    <div className="container py-8 md:py-12">
      <h1 className="section-title mb-4">Live Disaster Tracking Map</h1>
      <MapView />
    </div>
  )
}
