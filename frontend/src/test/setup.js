import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(cleanup)

// jsdom has no layout or SVG geometry. Leaflet checks for these when it loads,
// so give it just enough to render its real layers in tests.
window.SVGSVGElement.prototype.createSVGRect = () => ({})
vi.spyOn(window.HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000)
vi.spyOn(window.HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(560)
