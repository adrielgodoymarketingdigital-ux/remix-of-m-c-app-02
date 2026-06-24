const PIXEL_ID = import.meta.env.VITE_FACEBOOK_PIXEL_ID as string | undefined

export function initPixel() {
  if (typeof window === 'undefined' || !PIXEL_ID) return
  import('react-facebook-pixel').then(({ default: ReactPixel }) => {
    ReactPixel.init(PIXEL_ID, undefined, {
      autoConfig: true,
      debug: import.meta.env.DEV,
    })
  })
}

export async function trackPageView() {
  if (typeof window === 'undefined' || !PIXEL_ID) return
  const { default: ReactPixel } = await import('react-facebook-pixel')
  ReactPixel.pageView()
}
