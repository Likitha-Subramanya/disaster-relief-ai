import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="container py-16 text-center space-y-4">
      <div className="text-5xl font-bold">404</div>
      <div className="opacity-80">Page not found</div>
      <div>
        <Link to="/" className="button-primary">Go Home</Link>
      </div>
    </div>
  )
}
