import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { formatBytes } from '~/lib/storage/usage'
import type { StorageUsage } from '~/lib/storage/usage'

export const Route = createFileRoute('/admin/storage')({
  component: StorageDashboard,
})

// Query function to fetch storage data
/**
 * Error response from storage API
 */
interface StorageApiError {
  error: string
  message: string
}

async function fetchStorageUsage(): Promise<StorageUsage> {
  const response = await fetch('/api/admin/storage')

  if (!response.ok) {
    const error = (await response.json()) as StorageApiError
    throw new Error(error.message || 'Failed to fetch storage usage')
  }

  return response.json() as Promise<StorageUsage>
}

function StorageDashboard() {
  // Use React Query with 5-minute stale time to avoid excessive recalculation
  const { data, refetch, isFetching } = useSuspenseQuery({
    queryKey: ['storage-usage'],
    queryFn: fetchStorageUsage,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  })

  const handleRefresh = () => {
    refetch()
  }

  // Determine progress bar color based on percentage
  const isWarning = data.percentOfLimit >= 80
  const progressColor = isWarning ? 'bg-red-500' : 'bg-green-500'
  const progressBgColor = isWarning ? 'bg-red-100' : 'bg-green-100'

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Storage Usage Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Monitor R2 storage consumption and free tier limits
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isFetching}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isFetching ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Refreshing...
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </>
          )}
        </button>
      </div>

      {/* Data Source Badge */}
      <div className="mb-4">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
            data.source === 'hybrid'
              ? 'bg-blue-100 text-blue-800'
              : data.source === 'r2'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
          }`}
        >
          {data.source === 'hybrid'
            ? '📊 Hybrid (R2 totals + Database breakdown)'
            : data.source === 'r2'
              ? '☁️ R2 Direct'
              : '💾 Database Only'}
        </span>
      </div>

      {/* Warning Alert */}
      {isWarning && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <div className="flex items-start">
            <svg
              className="h-5 w-5 text-red-500 mt-0.5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Storage Limit Warning</h3>
              <p className="mt-1 text-sm text-red-700">
                You&apos;re using {data.percentOfLimit.toFixed(1)}% of your 10GB free tier limit.
                Consider upgrading or cleaning up unused files to avoid service interruption.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Total Storage Card */}
      <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Total Storage Used</h2>
        <div className="text-5xl font-bold mb-4 text-gray-900">
          {formatBytes(data.totalBytes)}
        </div>
        <div className="text-lg text-gray-600 mb-4">
          {data.totalFiles.toLocaleString()} {data.totalFiles === 1 ? 'file' : 'files'} stored
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>{data.percentOfLimit.toFixed(2)}% of 10GB free tier</span>
            <span>{formatBytes(10 * 1024 * 1024 * 1024)}</span>
          </div>
          <div className={`w-full h-4 ${progressBgColor} rounded-full overflow-hidden`}>
            <div
              className={`h-full ${progressColor} transition-all duration-500`}
              style={{ width: `${Math.min(data.percentOfLimit, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <StorageCard
          title="3D Models"
          subtitle=".stl, .3mf"
          count={data.breakdown.models.count}
          bytes={data.breakdown.models.bytes}
          icon="🧊"
        />
        <StorageCard
          title="Sliced Files"
          subtitle=".gcode.3mf, .gcode"
          count={data.breakdown.slices.count}
          bytes={data.breakdown.slices.bytes}
          icon="🔪"
        />
        <StorageCard
          title="Images"
          subtitle=".png, .jpg"
          count={data.breakdown.images.count}
          bytes={data.breakdown.images.bytes}
          icon="🖼️"
        />
      </div>

      {/* External Links */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold mb-2 text-blue-900">Need More Details?</h3>
        <p className="text-sm text-blue-800 mb-4">
          View detailed storage analytics, billing information, and historical usage trends in
          the Cloudflare Dashboard.
        </p>
        <a
          href="https://dash.cloudflare.com/r2"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Open Cloudflare Dashboard
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      </div>

      {/* Last Calculated Timestamp */}
      <div className="text-center text-sm text-gray-500">
        Last calculated: {new Date(data.lastCalculated).toLocaleString()}
      </div>
    </div>
  )
}

function StorageCard({
  title,
  subtitle,
  count,
  bytes,
  icon,
}: {
  title: string
  subtitle: string
  count: number
  bytes: number
  icon: string
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <span className="text-3xl">{icon}</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">{subtitle}</p>
      <div className="text-3xl font-bold mb-2 text-gray-900">{formatBytes(bytes)}</div>
      <div className="text-sm text-gray-600">
        {count.toLocaleString()} {count === 1 ? 'file' : 'files'}
      </div>
    </div>
  )
}
