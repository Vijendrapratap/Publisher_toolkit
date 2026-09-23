import { Composition, Still } from 'remotion'
import {
  BookTrailerComposition,
  type BookTrailerCompositionProps,
} from '../components/trailer/remotion/BookTrailerComposition'
import { AiCaption, AiEndCard } from '../components/trailer/remotion/AiAdParts'
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
    <>
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
      <Still
        id="AiCaption"
        component={AiCaption}
        width={1920}
        height={1080}
        defaultProps={{ spec: defaults.spec, caption: 'Caption' }}
        calculateMetadata={({ props }) => videoDimensions(props.spec.format)}
      />
      <Composition
        id="AiEndCard"
        component={AiEndCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={3 * FPS}
        defaultProps={{ spec: defaults.spec, coverUrl: null, headline: 'Headline', cta: 'Get your copy' }}
        calculateMetadata={({ props }) => videoDimensions(props.spec.format)}
      />
    </>
  )
}
