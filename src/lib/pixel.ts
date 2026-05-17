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

export async function trackCompleteRegistration() {
  if (typeof window === 'undefined' || !PIXEL_ID) return
  const { default: ReactPixel } = await import('react-facebook-pixel')
  ReactPixel.track('CompleteRegistration', {
    currency: 'BRL',
    status: true,
  })
  if (import.meta.env.DEV) {
    console.log('🎯 Pixel CompleteRegistration disparado')
  }
}

export async function trackInitiateCheckout(dados: {
  value?: number
  planName?: string
}) {
  if (typeof window === 'undefined' || !PIXEL_ID) return
  const { default: ReactPixel } = await import('react-facebook-pixel')
  ReactPixel.track('InitiateCheckout', {
    value: dados.value,
    currency: 'BRL',
    content_name: dados.planName ?? 'Assinatura',
    content_type: 'product',
    num_items: 1,
  })
  if (import.meta.env.DEV) {
    console.log('🎯 Pixel InitiateCheckout disparado:', dados)
  }
}

export async function trackPurchase(dados: {
  value: number
  currency?: string
  orderId?: string
  planName?: string
}) {
  if (typeof window === 'undefined' || !PIXEL_ID) return
  if (import.meta.env.DEV) {
    console.log('[Pixel] Purchase', dados)
  }
  const { default: ReactPixel } = await import('react-facebook-pixel')
  ReactPixel.track('Purchase', {
    value: dados.value,
    currency: dados.currency ?? 'BRL',
    content_name: dados.planName ?? 'Assinatura',
    content_type: 'product',
    order_id: dados.orderId,
  })
}
