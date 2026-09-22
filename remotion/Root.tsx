import { Composition } from 'remotion'
import {
  BookTrailerComposition,
  type BookTrailerCompositionProps,
} from '../components/trailer/remotion/BookTrailerComposition'
import { FPS, defaultVideoSpec, videoDimensions, videoDurationInFrames } from '../lib/services/ads/videoSpec'

const defaults: BookTrailerCompositionProps = {
  spec: defaultVideoSpec({ title: 'Preview' }),
  title: 'Preview',
  author: '',
  coverUrl: null,
  interiorImageUrls: [],
}

export function RemotionRoot() {
  return (
    <Composition
      id="AdVideo"
      component={BookTrailerComposition}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={videoDurationInFrames(defaults.spec)}
      defaultProps={defaults}
      calculateMetadata={({ props }) => ({
        ...videoDimensions(props.spec.format),
        durationInFrames: videoDurationInFrames(props.spec),
      })}
    />
  )
}
