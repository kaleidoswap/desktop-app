declare global {
  const __GIT_COMMIT__: string
  const __GIT_BRANCH__: string
  const __BUILD_DATE__: string
  const __NODE_ENV__: string

  interface Window {
    __GIT_COMMIT__?: string
    __GIT_BRANCH__?: string
    __BUILD_DATE__?: string
    __NODE_ENV__?: string
  }
}

export {}
