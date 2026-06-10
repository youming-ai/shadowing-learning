import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/player/$fileId')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/watch/$mediaId', params: { mediaId: params.fileId } })
  },
})
