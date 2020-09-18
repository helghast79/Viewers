import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import cornerstoneTools from 'cornerstone-tools';
import cornerstone from 'cornerstone-core';
import moment from 'moment';
import { utils, log } from '@ohif/core';
import { ScrollableArea, TableList, Icon } from '@ohif/ui';

import setActiveLabelmap from '../../utils/setActiveLabelMap';
import refreshViewports from '../../utils/refreshViewports';

import {
  BrushColorSelector,
  BrushRadius,
  SegmentationItem,
  SegmentItem,
  SegmentationSelect,
} from '../index';

import './SegmentationPanel.css';
import SegmentationSettings from '../SegmentationSettings/SegmentationSettings';

const { studyMetadataManager } = utils;

/**
 * SegmentationPanel component
 *
 * @param {Array} props.studies - Studies data
 * @param {Array} props.viewports - Viewports data (viewportSpecificData)
 * @param {number} props.activeIndex - Active viewport index
 * @param {boolean} props.isOpen - Boolean that indicates if the panel is expanded
 * @param {Function} props.onSegmentItemClick - Segment click handler
 * @param {Function} props.onSegmentVisibilityChange - Segment visibiliy change handler
 * @param {Function} props.onConfigurationChange - Configuration change handler
 * @param {Function} props.activeContexts - List of active application contexts
 * @param {Function} props.contexts - List of available application contexts
 * @returns component
 */
const SegmentationPanel = ({
  studies,
  viewports,
  activeIndex,
  isOpen,
  onSegmentItemClick,
  onSegmentVisibilityChange,
  onConfigurationChange,
  onDisplaySetLoadFailure,
  onSelectedSegmentationChange,
  activeContexts = [],
  contexts = {},
}) => {
  const isVTK = () => activeContexts.includes(contexts.VTK);
  const isCornerstone = () => activeContexts.includes(contexts.CORNERSTONE);

  /*
   * TODO: wrap get/set interactions with the cornerstoneTools
   * store with context to make these kind of things less blurry.
   */
  const { configuration } = cornerstoneTools.getModule('segmentation');
  const DEFAULT_BRUSH_RADIUS = configuration.radius || 10;

  /*
   * TODO: We shouldn't hardcode brushColor color, in the future
   * the SEG may set the colorLUT to whatever it wants.
   */
  const [state, setState] = useState({
    brushRadius: DEFAULT_BRUSH_RADIUS,
    brushColor: 'rgba(221, 85, 85, 1)',
    selectedSegment: null,
    selectedSegmentation: null,
    showSegmentationSettings: false,
    brushStackState: null,
    labelmapList: [],
    segmentList: [],
    cachedSegmentsProperties: [],
    isLoading: false,
    isDisabled: true,
  });

  useEffect(() => {
    const labelmapModifiedHandler = event => {

      log.warn('Segmentation Panel: labelmap modified', event);

      const module = cornerstoneTools.getModule('segmentation');
      const activeViewport = viewports[activeIndex];
      const studyMetadata = studyMetadataManager.get(
        activeViewport.StudyInstanceUID
      );
      const firstImageId = studyMetadata.getFirstImageId(
        activeViewport.displaySetInstanceUID
      );
      updateState('brushStackState', module.state.series[firstImageId]);

    };


    /*
     * TODO: Improve the way we notify parts of the app that depends on segs to be loaded.
     *
     * Currently we are using a non-ideal implementation through a custom event to notify the segmentation panel
     * or other components that could rely on loaded segmentations that
     * the segments were loaded so that e.g. when the user opens the panel
     * before the segments are fully loaded, the panel can subscribe to this custom event
     * and update itself with the new segments.
     *
     * This limitation is due to the fact that the cs segmentation module is an object (which will be
     * updated after the segments are loaded) that React its not aware of its changes
     * because the module object its not passed in to the panel component as prop but accessed externally.
     *
     * Improving this event approach to something reactive that can be tracked inside the react lifecycle,
     * allows us to easily watch the module or the segmentations loading process in any other component
     * without subscribing to external events.
     */
    document.addEventListener(
      'extensiondicomsegmentationsegloaded',
      refreshSegmentations
    );

    /*
     * These are specific to each element;
     * Need to iterate cornerstone-tools tracked enabled elements?
     * Then only care about the one tied to active viewport?
     */
    cornerstoneTools.store.state.enabledElements.forEach(enabledElement =>
      enabledElement.addEventListener(
        'cornerstonetoolslabelmapmodified',
        labelmapModifiedHandler
      )
    );

    return () => {
      document.removeEventListener(
        'extensiondicomsegmentationsegloaded',
        refreshSegmentations
      );

      cornerstoneTools.store.state.enabledElements.forEach(enabledElement =>
        enabledElement.removeEventListener(
          'cornerstonetoolslabelmapmodified',
          labelmapModifiedHandler
        )
      );
    };
  }, [activeIndex, viewports]);

  const refreshSegmentations = useCallback(() => {
    const module = cornerstoneTools.getModule('segmentation');
    const activeViewport = viewports[activeIndex];
    console.log('ªªªªªªªªªªªªªª', getActiveSegmentColor())
    const isDisabled = !activeViewport || !activeViewport.StudyInstanceUID;
    if (!isDisabled) {
      const studyMetadata = studyMetadataManager.get(
        activeViewport.StudyInstanceUID
      );
      const firstImageId = studyMetadata.getFirstImageId(
        activeViewport.displaySetInstanceUID
      );
      const brushStackState = module.state.series[firstImageId];
      if (brushStackState) {
        const labelmap3D =
          brushStackState.labelmaps3D[brushStackState.activeLabelmapIndex];
        const labelmapList = getLabelmapList(
          brushStackState,
          firstImageId,
          activeViewport
        );
        const segmentList = getSegmentList(
          labelmap3D,
          firstImageId,
          brushStackState
        );

        setState(state => ({
          ...state,
          brushStackState,
          selectedSegmentation: brushStackState.activeLabelmapIndex,//miguel: why not -> state.selectedSegment
          labelmapList,
          segmentList,
          isDisabled,
        }));
      } else {
        setState(state => ({
          ...state,
          labelmapList: [],
          segmentList: [],
          isDisabled,
        }));
      }
    }
  }, [viewports, activeIndex, state.isLoading]);

  useEffect(() => {
    refreshSegmentations();
  }, [
    viewports,
    activeIndex,
    isOpen,
    state.selectedSegmentation,
    activeContexts,
    state.isLoading,
  ]);

  /* Handle open/closed panel behaviour */
  useEffect(() => {
    setState(state => ({
      ...state,
      showSegmentationSettings: state.showSegmentationSettings && !isOpen,
    }));
  }, [isOpen]);

  const getLabelmapList = useCallback(
    (brushStackState, firstImageId, activeViewport) => {
      /* Get list of SEG labelmaps specific to active viewport (reference series) */
      const referencedSegDisplaysets = _getReferencedSegDisplaysets(
        activeViewport.StudyInstanceUID,
        activeViewport.SeriesInstanceUID
      );

      return referencedSegDisplaysets.map((displaySet, index) => {
        const { labelmapIndex, SeriesDate, SeriesTime } = displaySet;

        /* Map to display representation */
        const dateStr = `${SeriesDate}:${SeriesTime}`.split('.')[0];
        const date = moment(dateStr, 'YYYYMMDD:HHmmss');
        const isActiveLabelmap =
          labelmapIndex === brushStackState.activeLabelmapIndex;
        const displayDate = date.format('ddd, MMM Do YYYY');
        const displayTime = date.format('h:mm:ss a');
        const displayDescription = displaySet.SeriesDescription;

        return {
          value: labelmapIndex,
          title: displayDescription,
          description: displayDate,
          onClick: async () => {
            const activatedLabelmapIndex = await setActiveLabelmap(
              activeViewport,
              studies,
              displaySet,
              () => onSelectedSegmentationChange(),
              onDisplaySetLoadFailure
            );
            updateState('selectedSegmentation', activatedLabelmapIndex);

          },
        };
      });
    },
    [studies]
  );

  const getSegmentList = useCallback(
    (labelmap3D, firstImageId, brushStackState) => {
      /*
       * Newly created segments have no `meta`
       * So we instead build a list of all segment indexes in use
       * Then find any associated metadata
       */

      const uniqueSegmentIndexes = labelmap3D.labelmaps2D
        .reduce((acc, labelmap2D) => {
          if (labelmap2D) {
            const segmentIndexes = labelmap2D.segmentsOnLabelmap;

            for (let i = 0; i < segmentIndexes.length; i++) {
              if (!acc.includes(segmentIndexes[i]) && segmentIndexes[i] !== 0) {
                acc.push(segmentIndexes[i]);
              }
            }
          }

          return acc;
        }, [])
        .sort((a, b) => a - b);

      const module = cornerstoneTools.getModule('segmentation');
      const colorLutTable =
        module.state.colorLutTables[labelmap3D.colorLUTIndex];
      const hasLabelmapMeta = labelmap3D.metadata && labelmap3D.metadata.data;

      const segmentList = [];
      for (let i = 0; i < uniqueSegmentIndexes.length; i++) {
        const segmentIndex = uniqueSegmentIndexes[i];

        const color = colorLutTable[segmentIndex];
        let segmentLabel = '(unlabeled)';
        let segmentNumber = segmentIndex;

        /* Meta */
        if (hasLabelmapMeta) {
          const segmentMeta = labelmap3D.metadata.data[segmentIndex];

          if (segmentMeta) {
            segmentNumber = segmentMeta.SegmentNumber;
            segmentLabel = segmentMeta.SegmentLabel;
          }
        }

        const sameSegment = state.selectedSegment === segmentNumber;

        const setCurrentSelectedSegment = () => {

          console.log('??? 1', segmentNumber)
          _setActiveSegment(
            firstImageId,
            segmentNumber,
            labelmap3D.activeSegmentIndex
          );
          updateState('selectedSegment', segmentNumber) //sameSegment ? null : segmentNumber);
          console.log('??? 2')
          if (!sameSegment) {
            updateActiveSegmentColor()
          }
          console.log('??? 3')
          const validIndexList = [];
          labelmap3D.labelmaps2D.forEach((labelMap2D, index) => {
            if (labelMap2D.segmentsOnLabelmap.includes(segmentNumber)) {
              validIndexList.push(index);
            }
          });
          let closest = 0
          if (validIndexList.length) {
            const avg = array => array.reduce((a, b) => a + b) / array.length;
            const average = avg(validIndexList);
            closest = validIndexList.reduce((prev, curr) => {
              return Math.abs(curr - average) < Math.abs(prev - average)
                ? curr
                : prev;
            });
          }

          console.log('??? 4')
          if (isCornerstone()) {
            const enabledElements = cornerstone.getEnabledElements();
            const element = enabledElements[activeIndex].element;
            const toolState = cornerstoneTools.getToolState(element, 'stack');

            if (!toolState) {
              return;
            }

            const imageIds = toolState.data[0].imageIds;
            const imageId = imageIds[closest];
            const frameIndex = imageIds.indexOf(imageId);

            const SOPInstanceUID = cornerstone.metaData.get(
              'SOPInstanceUID',
              imageId
            );
            const StudyInstanceUID = cornerstone.metaData.get(
              'StudyInstanceUID',
              imageId
            );
            console.log('??? 5')
            onSegmentItemClick({
              StudyInstanceUID,
              SOPInstanceUID,
              frameIndex,
              activeViewportIndex: activeIndex,
            });
          }

          if (isVTK()) {
            const activeViewport = viewports[activeIndex];
            const studyMetadata = studyMetadataManager.get(
              activeViewport.StudyInstanceUID
            );
            const allDisplaySets = studyMetadata.getDisplaySets();
            const currentDisplaySet = allDisplaySets.find(
              displaySet =>
                displaySet.displaySetInstanceUID ===
                activeViewport.displaySetInstanceUID
            );

            const frame = labelmap3D.labelmaps2D[closest];

            onSegmentItemClick({
              studies,
              StudyInstanceUID: currentDisplaySet.StudyInstanceUID,
              displaySetInstanceUID: currentDisplaySet.displaySetInstanceUID,
              SOPClassUID: viewports[activeIndex].sopClassUIDs[0],
              SOPInstanceUID: currentDisplaySet.SOPInstanceUID,
              segmentNumber,
              frameIndex: closest,
              frame,
            });
          }



        };

        const isSegmentVisible = () => {
          return !labelmap3D.segmentsHidden[segmentIndex];
        };

        const toggleSegmentVisibility = () => {
          const segmentsHidden = labelmap3D.segmentsHidden;
          segmentsHidden[segmentIndex] = !segmentsHidden[segmentIndex];
          return !segmentsHidden[segmentIndex];
        };

        const cachedSegmentProperties =
          state.cachedSegmentsProperties[segmentNumber];
        let visible = isSegmentVisible();
        if (
          cachedSegmentProperties &&
          cachedSegmentProperties.visible !== visible
        ) {
          toggleSegmentVisibility();
        }

        const selectedClass = (state.selectedSegment === segmentNumber ? 'selected' : '')
        segmentList.push(
          <SegmentItem
            key={segmentNumber}
            itemClass={`segment-item ${selectedClass}`}
            onClick={() => setCurrentSelectedSegment()}
            label={segmentLabel}
            index={segmentNumber}
            color={color}
            visible={visible}
            onVisibilityChange={newVisibility => {
              if (isCornerstone()) {
                const enabledElements = cornerstone.getEnabledElements();
                const element = enabledElements[activeIndex].element;
                module.setters.toggleSegmentVisibility(
                  element,
                  segmentNumber,
                  brushStackState.activeLabelmapIndex
                );
              }

              if (isVTK()) {
                onSegmentVisibilityChange(segmentNumber, newVisibility);
              }

              updateCachedSegmentsProperties(segmentNumber, {
                visible: newVisibility,
              });
              refreshViewports();
            }}
          />
        );
      }

      return segmentList;

      /*
       * Let's iterate over segmentIndexes ^ above
       * If meta has a match, use it to show info
       * If now, add "no-meta" class
       * Show default name
       */
    },
    [activeIndex, onSegmentItemClick, state.selectedSegment, state.isLoading]
  );

  const updateCachedSegmentsProperties = (segmentNumber, properties) => {
    const segmentsProperties = state.cachedSegmentsProperties;
    const segmentProperties = state.cachedSegmentsProperties[segmentNumber];

    segmentsProperties[segmentNumber] = segmentProperties
      ? { ...segmentProperties, ...properties }
      : properties;

    updateState('cachedSegmentsProperties', segmentsProperties);
  };

  useEffect(() => {
    updateState('cachedSegmentsProperties', []);
  }, [activeContexts]);

  const updateState = (field, value) => {
    setState(state => ({ ...state, [field]: value }));
  };

  const updateBrushSize = evt => {
    const updatedRadius = Number(evt.target.value);

    if (updatedRadius !== state.brushRadius) { //miguel: brushRadius is managed by state
      updateState('brushRadius', updatedRadius);
      const module = cornerstoneTools.getModule('segmentation');
      module.setters.radius(updatedRadius);
    }
  };

  const decrementSegment = event => {
    event.preventDefault();
    if (labelmap3D.activeSegmentIndex > 1) {
      labelmap3D.activeSegmentIndex--;
    }
    updateState('selectedSegment', labelmap3D.activeSegmentIndex);
    updateActiveSegmentColor();
  };

  const incrementSegment = event => {
    event.preventDefault();
    labelmap3D.activeSegmentIndex++;
    updateState('selectedSegment', labelmap3D.activeSegmentIndex);
    updateActiveSegmentColor();
  };

  const updateActiveSegmentColor = () => {
    const color = getActiveSegmentColor();
    updateState('brushColor', color);
  };

  const getActiveSegmentColor = () => {
    if (!state.brushStackState) {
      return 'rgba(255, 255, 255, 1)';
    }
    //miguel: labelmap3D is referenced without being defined
    const activeLabelIndex = state.brushStackState.activeLabelmapIndex
    const labelmap3D = state.brushStackState.labelmaps3D[activeLabelIndex];

    const module = cornerstoneTools.getModule('segmentation');
    const colorLutTable = module.state.colorLutTables[labelmap3D.colorLUTIndex];
    const color = colorLutTable[labelmap3D.activeSegmentIndex];

    return `rgba(${color.join(',')})`;
  };

  const updateConfiguration = newConfiguration => {
    configuration.renderFill = newConfiguration.renderFill;
    configuration.renderOutline = newConfiguration.renderOutline;
    configuration.shouldRenderInactiveLabelmaps =
      newConfiguration.shouldRenderInactiveLabelmaps;
    configuration.fillAlpha = newConfiguration.fillAlpha;
    configuration.outlineAlpha = newConfiguration.outlineAlpha;
    configuration.outlineWidth = newConfiguration.outlineWidth;
    configuration.fillAlphaInactive = newConfiguration.fillAlphaInactive;
    configuration.outlineAlphaInactive = newConfiguration.outlineAlphaInactive;
    onConfigurationChange(newConfiguration);
    refreshViewports();
  };
  const addSegment = (state) => {


    const enabledElements = cornerstone.getEnabledElements()
    const element = enabledElements[0].element


    const module = cornerstoneTools.getModule('segmentation');
    // //getters.activeSegmentIndex(element)
    // const activeLabelmapIndex = getters.labelmaps3D(element).activeLabelmapIndex
    // const labelmaps3D = getters.labelmaps3D(element).labelmaps3D[activeLabelmapIndex]

    //move to last segment index
    //setters.activeSegmentIndex(element, segmentList.length + 1)

    // getters.activeLabelmapBuffer(
    //   element
    // );


    //segmentation objects are null
    if (typeof module.getters.labelmaps3D(element).activeLabelmapIndex === 'undefined') {
      module.setters.activeLabelmapIndex(element, 0)
    }

    // const activeViewport = viewports[activeIndex];
    // const studyMetadata = studyMetadataManager.get(
    //   activeViewport.StudyInstanceUID
    // );
    // const firstImageId = studyMetadata.getFirstImageId(
    //   activeViewport.displaySetInstanceUID
    // );

    // module.state.series[firstImageId]={
    //   activeLabelmapIndex: 0,
    //   labelmaps3D: [

    //   ]
    // }




    // labelmap3D.activeSegmentIndex = state.segmentList.length + 1;

    // updateState('selectedSegment', labelmap3D.activeSegmentIndex);
    // updateActiveSegmentColor();
    //console.log(state)
    //console.log(state.brushStackState)

    const activeLabelIndex = module.getters.labelmaps3D(element).activeLabelmapIndex; //state.brushStackState.activeLabelmapIndex
    const labelmap3D = module.getters.labelmaps3D(element).labelmaps3D[activeLabelIndex]; //  state.brushStackState.labelmaps3D[activeLabelIndex];

    //get next segment number
    const newSegmentNumber = state.segmentList.length + 1


    if (labelmap3D.labelmaps2D && labelmap3D.labelmaps2D.length) {
      //first key might be > 0
      const firstKey = Object.keys(labelmap3D.labelmaps2D)[0]
      //there is a segmentation already created
      labelmap3D.labelmaps2D[firstKey].segmentsOnLabelmap.push(newSegmentNumber)

    } else {
      //no segmentations yet so create one
      const imageSizeInBytes = enabledElements[0].image.sizeInBytes
      labelmap3D.labelmaps2D.push({
        pixelData: new Uint16Array(imageSizeInBytes),
        segmentsOnLabelmap: [0, newSegmentNumber]
      });
    }

    refreshSegmentations()

    //now remove the reference to the newSegmentNumber
    //labelmap3D.labelmaps2D[0].segmentsOnLabelmap = labelmap3D.labelmaps2D[0].segmentsOnLabelmap.filter(v => v != newSegmentNumber)

  };

  const disabledConfigurationFields = [
    'outlineAlpha',
    'shouldRenderInactiveLabelmaps',
  ];
  if (state.showSegmentationSettings) {
    return (
      <SegmentationSettings
        disabledFields={isVTK() ? disabledConfigurationFields : []}
        configuration={configuration}
        onBack={() => updateState('showSegmentationSettings', false)}
        onChange={updateConfiguration}
      />
    );
  } else {
    return (
      <div
        className={`dcmseg-segmentation-panel ${state.isDisabled &&
          'disabled'}`}
      >
        <Icon
          className="cog-icon"
          name="cog"
          width="25px"
          height="25px"
          onClick={() => updateState('showSegmentationSettings', true)}
        />
        {false && (
          <form className="selector-form">
            <BrushColorSelector
              defaultColor={state.brushColor} //miguel: brushColor is managed by state, was ---> brushColor

              index={state.selectedSegment}

              //miguel: should have a onClick event to open color selector (showing all colorLUT's)
              //miguel: maybe a onChange to update labels
              onNext={incrementSegment}
              onPrev={decrementSegment}
            />
            <BrushRadius
              value={state.brushRadius} //miguel: brushRadius is managed by state was ---> brushRadius
              onChange={updateBrushSize}
              min={configuration.minRadius}
              max={configuration.maxRadius}
            />
          </form>
        )}
        <h3>Segmentations</h3>
        <div className="segmentations">
          <SegmentationSelect
            value={state.labelmapList.find(
              i => i.value === state.selectedSegmentation
            )}
            formatOptionLabel={SegmentationItem}
            options={state.labelmapList}
          />
        </div>
        <ScrollableArea>
          <TableList
            customHeader={<SegmentsHeader
              count={state.segmentList.length}
              onAddSegment={() => addSegment(state)}
            />}
          >
            {state.segmentList}
          </TableList>
        </ScrollableArea>
      </div>
    );
  }
};

SegmentationPanel.propTypes = {
  /*
   * An object, with int index keys?
   * Maps to: state.viewports.viewportSpecificData, in `viewer`
   * Passed in MODULE_TYPES.PANEL when specifying component in viewer
   */
  viewports: PropTypes.shape({
    displaySetInstanceUID: PropTypes.string,
    frameRate: PropTypes.any,
    InstanceNumber: PropTypes.number,
    isMultiFrame: PropTypes.bool,
    isReconstructable: PropTypes.bool,
    Modality: PropTypes.string,
    plugin: PropTypes.string,
    SeriesDate: PropTypes.string,
    SeriesDescription: PropTypes.string,
    SeriesInstanceUID: PropTypes.string,
    SeriesNumber: PropTypes.any,
    SeriesTime: PropTypes.string,
    sopClassUIDs: PropTypes.arrayOf(PropTypes.string),
    StudyInstanceUID: PropTypes.string,
  }),
  activeIndex: PropTypes.number.isRequired,
  studies: PropTypes.array.isRequired,
  isOpen: PropTypes.bool.isRequired,
};
SegmentationPanel.defaultProps = {};

/**
 * Returns SEG Displaysets that reference the target series, sorted by dateTime
 *
 * @param {string} StudyInstanceUID
 * @param {string} SeriesInstanceUID
 * @returns Array
 */
const _getReferencedSegDisplaysets = (StudyInstanceUID, SeriesInstanceUID) => {
  /* Referenced DisplaySets */
  const studyMetadata = studyMetadataManager.get(StudyInstanceUID);
  const referencedDisplaysets = studyMetadata.getDerivedDatasets({
    referencedSeriesInstanceUID: SeriesInstanceUID,
    Modality: 'SEG',
  });

  /* Sort */
  referencedDisplaysets.sort((a, b) => {
    const aNumber = Number(`${a.SeriesDate}${a.SeriesTime}`);
    const bNumber = Number(`${b.SeriesDate}${b.SeriesTime}`);
    return aNumber - bNumber;
  });

  return referencedDisplaysets;
};

/**
 *
 * @param {*} firstImageId
 * @param {*} activeSegmentIndex
 * @returns
 */
const _setActiveSegment = (firstImageId, segmentIndex, activeSegmentIndex) => {
  if (segmentIndex === activeSegmentIndex) {
    log.info(`${activeSegmentIndex} is already the active segment`);
    return;
  }

  const { state } = cornerstoneTools.getModule('segmentation');
  const brushStackState = state.series[firstImageId];

  const labelmap3D =
    brushStackState.labelmaps3D[brushStackState.activeLabelmapIndex];
  labelmap3D.activeSegmentIndex = segmentIndex;

  refreshViewports();

  return segmentIndex;
};





const SegmentsHeader = ({ count, onAddSegment }) => {

  return (
    <React.Fragment>
      <div className="tableListHeaderTitle">Segments
        <Icon
          className="plus-icon"
          name="plus"
          width="20px"
          height="20px"
          onClick={onAddSegment}
        />

      </div>
      <div className="numberOfItems">{count}</div>
    </React.Fragment>
  );
};

export default SegmentationPanel;
