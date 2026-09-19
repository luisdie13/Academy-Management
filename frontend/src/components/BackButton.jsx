import { Link } from 'react-router-dom'

function BackButton({ to, label = '← Regresar' }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
    >
      {label}
    </Link>
  )
}

export default BackButton
