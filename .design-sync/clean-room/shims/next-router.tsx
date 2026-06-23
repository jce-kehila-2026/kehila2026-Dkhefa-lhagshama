import React from 'react'

const router = {
  pathname: '/',
  asPath: '/',
  route: '/',
  basePath: '',
  query: {} as Record<string, string>,
  isReady: true,
  isFallback: false,
  isPreview: false,
  locale: undefined,
  locales: [] as string[],
  defaultLocale: undefined,
  push: async () => true,
  replace: async () => true,
  prefetch: async () => undefined,
  back: () => {},
  forward: () => {},
  reload: () => {},
  beforePopState: () => {},
  events: { on: () => {}, off: () => {}, emit: () => {} },
}

export function useRouter() {
  return router
}

export function withRouter(Component: any) {
  return function WithRouter(props: any) {
    return React.createElement(Component, { ...props, router })
  }
}

export default router
