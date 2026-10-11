import { Composition, Still } from 'remotion'
import {
  BookTrailerComposition,
  type BookTrailerCompositionProps,
} from '../components/trailer/remotion/BookTrailerComposition'
import { AiCaption, AiEndCard } from '../components/trailer/remotion/AiAdParts'
import { FPS, defaultVideoSpec, presetStyle, videoDimensions, videoDurationInFrames } from '../lib/services/ads/videoSpec'
import { BookAd, type BookAdProps } from '../components/ads/remotion/BookAd'
import { fixedStoryboard, storyboardDurationInFrames } from '../lib/services/ads/storyboard'

const defaults: BookTrailerCompositionProps = {
  spec: defaultVideoSpec({ title: 'Preview' }),
  title: 'Preview',
  author: '',
  coverUrl: null,
  interiorImageUrls: [],
}

const bookAdDefaults: BookAdProps = {
  spec: defaults.spec,
  storyboard: fixedStoryboard({ title: 'Preview', pageCount: 0, cta: 'Get your copy', lengthSec: 15, style: presetStyle('cinematic') }),
  title: 'Preview',
  author: '',
  coverUrl: null,
  pageUrls: [],
  settingUrl: null,
}

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="BookAd"
        component={BookAd}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={storyboardDurationInFrames(bookAdDefaults.storyboard.beats)}
        defaultProps={bookAdDefaults}
        calculateMetadata={({ props }) => ({
          ...videoDimensions(props.spec.format),
          durationInFrames: storyboardDurationInFrames(props.storyboard.beats),
        })}
      />
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
