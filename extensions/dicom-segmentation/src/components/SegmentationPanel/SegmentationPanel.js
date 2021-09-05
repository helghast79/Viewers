import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import cornerstoneTools from 'cornerstone-tools';
import cornerstone from 'cornerstone-core';
import moment from 'moment';
import { utils, log } from '@ohif/core';
import { ScrollableArea, TableList, Icon, SimpleDialog } from '@ohif/ui';
import DICOMSegTempCrosshairsTool from '../../tools/DICOMSegTempCrosshairsTool';

import setActiveLabelmap from '../../utils/setActiveLabelMap';
import refreshViewports from '../../utils/refreshViewports';

//import dcmjs from './dcmjsModified';
import dcmjs from './dcmjsCompiled';


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
  dialogFunction,
  relabelSegmentModal,
  deleteDialogFunction
}) => {
  const isVTK = () => activeContexts.includes(contexts.VTK);
  const isCornerstone = () => activeContexts.includes(contexts.CORNERSTONE);

  /*
   * TODO: wrap get/set interactions with the cornerstoneTools
   * store with context to make these kind of things less blurry.
   */
  let { configuration } = cornerstoneTools.getModule('segmentation')

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
    showSettings: false,
    brushStackState: null,
    labelmapList: [],
    segmentList: [],
    cachedSegmentsProperties: [],
    isLoading: false,
    isDisabled: true,
  });
  window.state = state

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

    // document.addEventListener(
    //   'extensiondicomsegmentationsegselected',
    //   updateSegmentationComboBox
    // );

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
  }, [
    activeIndex,
    viewports,
    state.brushStackState
  ]);

  const refreshSegmentations = useCallback(() => {
    const module = cornerstoneTools.getModule('segmentation');
    const activeViewport = viewports[activeIndex];

    const isDisabled = !activeViewport || !activeViewport.StudyInstanceUID;
    if (!isDisabled) {
      const studyMetadata = studyMetadataManager.get(
        activeViewport.StudyInstanceUID
      );
      const firstImageId = studyMetadata.getFirstImageId(
        activeViewport.displaySetInstanceUID
      );
      const brushStackState = module.state.series[firstImageId];


      //console.log('*******>>>>>>', activeIndex, enabledElements[activeIndex], activeLabelmapIndex)
      if (!brushStackState.activeLabelmapIndex) {
        brushStackState.activeLabelmapIndex = activeIndex
      }

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
          selectedSegmentation: brushStackState.activeLabelmapIndex,
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
  }, [
    viewports,
    activeIndex,
    state.isLoading
  ]);

  useEffect(() => {
    refreshSegmentations();
  }, [
    viewports,
    activeIndex,
    isOpen,
    state.selectedSegmentation,
    activeContexts,
    state.isLoading,
    state.brushStackState
  ]);

  /* Handle open/closed panel behaviour */
  useEffect(() => {
    setState(state => ({
      ...state,
      showSettings: state.showSettings && !isOpen,
    }));
  }, [isOpen]);

  const getLabelmapList = useCallback(
    (brushStackState, firstImageId, activeViewport) => {

      /* Get list of SEG labelmaps specific to active viewport (reference series) */
      const referencedSegDisplaysets = _getReferencedSegDisplaysets(
        activeViewport.StudyInstanceUID,
        activeViewport.SeriesInstanceUID
      );

      let labelmapList = [];

      //get labelMapList from referecedDisplaySets
      labelmapList = referencedSegDisplaysets.map((displaySet, index) => {

        const { labelmapIndex, SeriesDate, SeriesTime } = displaySet;

        /* Map to display representation */
        const dateStr = `${SeriesDate}:${SeriesTime}`.split('.')[0];
        const date = moment(dateStr, 'YYYYMMDD:HHmmss');
        const isActiveLabelmap =
          labelmapIndex === brushStackState.activeLabelmapIndex;
        const displayDate = date.format('ddd, MMM Do YYYY');
        const displayTime = date.format('h:mm:ss a');
        const displayDescription = brushStackState.labelmaps3D[labelmapIndex].metadata.SeriesDescription; //displaySet.SeriesDescription;

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


      //other labelMaps are user created and only exist in brushStackState
      brushStackState.labelmaps3D.forEach((labelMap3D, i) => {
        if (i < referencedSegDisplaysets.length) {
          return true;
        }

        const todayDate = moment(new Date(), 'YYYYMMDD:HHmmss');
        const description = todayDate.format('ddd, MMM Do YYYY');
        const title = labelMap3D.metadata.SeriesDescription || "New segmentation";

        labelmapList.push({
          value: i,
          title: title,
          description: description,
          onClick: async () => {
            brushStackState.activeLabelmapIndex = i;
            refreshViewports();
            onSelectedSegmentationChange()
            updateState('selectedSegmentation', i);
          },
        })

      })

      return labelmapList;
    },
    [studies,
      state.labelmapList]
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
          _setActiveSegment(
            firstImageId,
            segmentNumber,
            labelmap3D.activeSegmentIndex
          );
          updateState('selectedSegment', sameSegment ? null : segmentNumber);

          const validIndexList = [];

          labelmap3D.labelmaps2D.forEach((labelMap2D, index) => {
            if (labelMap2D.segmentsOnLabelmap.includes(segmentNumber)) {
              validIndexList.push(index);
            }
          });
          const avg = array => array.reduce((a, b) => a + b, 0) / array.length;
          const average = avg(validIndexList);
          const closest = validIndexList.reduce((prev, curr) => {
            return Math.abs(curr - average) < Math.abs(prev - average)
              ? curr
              : prev;
          }, 0);

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

            DICOMSegTempCrosshairsTool.addCrosshair(
              element,
              imageId,
              segmentNumber
            );

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
        const segmentMetadata = labelmap3D.metadata.data[segmentIndex]

        segmentList.push(
          <SegmentItem
            key={segmentNumber}
            index={parseInt(segmentNumber)}
            label={segmentLabel}
            onClick={() => setCurrentSelectedSegment()}
            itemClass={`segment-item ${sameSegment && 'selected'}`}
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
            dialogFunction={dialogFunction}
            relabelSegmentModal={relabelSegmentModal}
            deleteDialogFunction={deleteDialogFunction}
            segmentMetadata={segmentMetadata}
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
    configuration.uploadSegmentationsUrl = newConfiguration.uploadSegmentationsUrl;
    onConfigurationChange(newConfiguration);
    refreshViewports();
  };

  //add new label map
  const addSegmentation = (state) => {

    const enabledElements = cornerstone.getEnabledElements()
    const element = enabledElements[activeIndex].element
    const toolState = cornerstoneTools.getToolState(element, "stack");

    const imageIds = toolState.data[0].imageIds;
    const firstImageId = imageIds[0];

    let imagePromises = [];
    for (let i = 0; i < imageIds.length; i++) {
      imagePromises.push(
        cornerstone.loadImage(imageIds[i])
      );
    }

    let overallSize = 0;

    Promise.all(imagePromises).then(images => {
      images.forEach(image => {
        overallSize += image.sizeInBytes
      });

      const labelmapBuffer = new Uint16Array(overallSize)

      const module = cornerstoneTools.getModule('segmentation');

      //get the total label maps and add a new one
      const labelmaps3D = module.getters.labelmaps3D(element).labelmaps3D;

      let labelmapIndex = 0;
      if (typeof labelmaps3D !== 'undefined') {
        labelmapIndex = module.getters.labelmaps3D(element).labelmaps3D.length;
      }

      const segMetadata = {
        data: [],
        seriesInstanceUid: cornerstone.metaData.get('SeriesInstanceUID', firstImageId)
      }
      const segmentsOnFrame = 1;

      let colorLUTIndex = 0;
      for (let i = 0; i < module.state.colorLutTables.length; i++) {
        if (!module.state.colorLutTables[i]) {
          colorLUTIndex = i;
          break;
        }
      }

      module.setters.labelmap3DByFirstImageId(
        firstImageId,
        labelmapBuffer.buffer,
        labelmapIndex,
        segMetadata,
        imageIds.length,
        segmentsOnFrame,
        colorLUTIndex
      );

      module.setters.activeLabelmapIndex(element, labelmapIndex)
      updateState('brushStackState', module.state.series[firstImageId]);
      updateState('selectedSegmentation', labelmapIndex);
    })
  };
  //add segment to
  const addSegment = (state) => {
    const enabledElements = cornerstone.getEnabledElements()
    const element = enabledElements[activeIndex].element

    const module = cornerstoneTools.getModule('segmentation');

    //segmentation objects are null
    if (typeof module.getters.labelmaps3D(element).activeLabelmapIndex === 'undefined') {
      module.setters.activeLabelmapIndex(element, 0)
    }

    const activeLabelIndex = module.getters.labelmaps3D(element).activeLabelmapIndex; //state.brushStackState.activeLabelmapIndex
    const labelmap3D = module.getters.labelmap3D(element, activeLabelIndex); //  state.brushStackState.labelmaps3D[activeLabelIndex];

    //get next segment number
    const newSegmentNumber = state.segmentList.length + 1

    //this is an ugly way to make the segment show in the list
    if (labelmap3D.labelmaps2D && labelmap3D.labelmaps2D.length) {
      //first key might be > 0
      const firstKey = Object.keys(labelmap3D.labelmaps2D)[0]
      //add the new segmentNumber to the first image slice (there is no brush data there for this segment)
      labelmap3D.labelmaps2D[firstKey].segmentsOnLabelmap.push(newSegmentNumber)

    } else {
      const imageSizeInBytes = enabledElements[activeIndex].image.sizeInBytes
      //no segments yet so create a labelmap2D and point the new segmentNumber to the first image slice (there is no brush data there for this segment)
      labelmap3D.labelmaps2D.push({
        pixelData: new Uint16Array(imageSizeInBytes),
        segmentsOnLabelmap: [0, newSegmentNumber]
      });
    }

    //get the new segment color
    const colorLUTIndex = labelmap3D.colorLUTIndex;
    const segmentColor = module.getters.colorForSegmentIndexColorLUT(colorLUTIndex, newSegmentNumber); //ex: [221.33999999999997, 84.66000000000001, 84.66000000000001, 255]

    let color = segmentColor.map(c => c / 255);//convert to sRGB
    //color.pop()//remove alpha channel
    color = dcmjs.data.Colors.rgb2DICOMLAB(color);//convert to DicomLab
    color = color.map(c => Math.round(c));

    //also create a basic metadata to start
    labelmap3D.metadata.data[newSegmentNumber] = {
      RecommendedDisplayCIELabValue: color,
      SegmentNumber: newSegmentNumber.toString(), //the index of the segment in labelmap3d (needs to be in sequence 1, 2, 3, ...)
      SegmentLabel: "Not specified", // can be user defined or equal to CodeMeaning in SegmentedPropertyTypeCodeSequence
      SegmentAlgorithmType: "MANUAL", //MANUAL, SEMIAUTOMATIC, AUTOMATIC
      SegmentAlgorithmName: "user created", //name required if algorithmtype != manual
      SegmentedPropertyCategoryCodeSequence: {
        CodeValue: "999000",
        CodingSchemeDesignator: "L",
        CodeMeaning: "Other"
      },
      SegmentedPropertyTypeCodeSequence: {
        CodeValue: "999000",
        CodingSchemeDesignator: "L",
        CodeMeaning: "Other"
      },
      // SegmentedPropertyTypeModifierCodeSequence: {
      //   CodeValue: "999000",
      //   CodingSchemeDesignator: "L",
      //   CodeMeaning: "Other"
      // }
    }



    refreshSegmentations();
  };




  const generateSegmentationBlob = () => {

    const enabledElements = cornerstone.getEnabledElements()
    const element = enabledElements[activeIndex].element

    const globalToolStateManager =
      cornerstoneTools.globalImageIdSpecificToolStateManager;
    const toolState = globalToolStateManager.saveToolState();

    const stackToolState = cornerstoneTools.getToolState(element, "stack");
    const imageIds = stackToolState.data[0].imageIds;

    const { getters } = cornerstoneTools.getModule('segmentation');

    const activeLabelMapIndex = getters.activeLabelmapIndex(element);
    const labelmap3D = getters.labelmap3D(element, activeLabelMapIndex);

    if (!labelmap3D) {
      console.log('no labelmap3D')
      return null;
    }

    //save some data to tag fields by passing acepted fields by DCMJS (check DerivedDataset line 5434 of dcmjModified.js)
    let options = {
      SeriesDescription: labelmap3D.metadata.SeriesDescription,
      SeriesNumber: +activeLabelMapIndex + 1,
      ImageComments: 'RESEARCH',
      Manufacturer: "Dr. Who",//use username from clinity exposed in window
    }

    let correctedLabelMap;
    //correct nested metadata in labelmaps3D (required metadata is actually inside data prop in metadata)
    if (labelmap3D.metadata.data) {
      correctedLabelMap = { ...labelmap3D, metadata: labelmap3D.metadata.data };
    } else {
      correctedLabelMap = { ...labelmap3D }
    }

    let correctedLabelMaps3d = [];

    //this step is unecessary once all labelMap2d's are properly set with metadata
    // correctedLabelMap.labelmaps2D.forEach(labelMap2d => {

    //   labelMap2d.segmentsOnLabelmap.forEach(segIndex => {

    //     //mock metadata for segments with no metadata specified (required by dcmjs)
    //     if (segIndex !== 0 && !correctedLabelMap.metadata[segIndex]) {

    //       correctedLabelMap.metadata[segIndex] = {
    //         RecommendedDisplayCIELabValue: dcmjs.data.Colors.rgb2DICOMLAB([
    //           1,
    //           0,
    //           0
    //         ]),
    //         SegmentedPropertyCategoryCodeSequence: {
    //           CodeValue: "T-D0050",
    //           CodingSchemeDesignator: "SRT",
    //           CodeMeaning: "Tissue"
    //         },
    //         SegmentNumber: segIndex.toString(), //the index of the segment in labelmap3d (needs to be in sequence 1, 2, 3, ...)
    //         SegmentLabel: "Tissue " + segIndex.toString(), // can be user defined or equal to CodeMeaning in SegmentedPropertyTypeCodeSequence
    //         SegmentAlgorithmType: "SEMIAUTOMATIC", //MANUAL, SEMIAUTOMATIC, AUTOMATIC
    //         SegmentAlgorithmName: "Slicer Prototype", //name required if algorithmtype != manual
    //         SegmentedPropertyTypeCodeSequence: {
    //           CodeValue: "T-D0050",
    //           CodingSchemeDesignator: "SRT",
    //           CodeMeaning: "Tissue"
    //         },
    //         SegmentedPropertyTypeModifierCodeSequence: {
    //           CodeValue: "T-D0050",
    //           CodingSchemeDesignator: "SRT",
    //           CodeMeaning: "Tissue"
    //         }
    //       }

    //     }

    //   })
    // })

    correctedLabelMaps3d.push(correctedLabelMap)

    const isMultiframe = imageIds[0].includes("?frame")

    let datasets = []

    if (isMultiframe) {
      datasets.push(cornerstone.metaData.get('instance', imageId[0]))

    } else {
      imageIds.forEach(imageId => {
        //let instance = cornerstone.metaData.get('instance', imageId)
        //instance._meta = [] //array needs to be present
        datasets.push(cornerstone.metaData.get('instance', imageId))
      });
    }

    const segBlob = dcmjs.adapters.Cornerstone.Segmentation.generateSegmentationFromDatasets(
      datasets,
      correctedLabelMaps3d,
      options
    );

    return segBlob;
  }



  // create dicom-seg and download in browser
  const downloadSegmentation = () => {
    const activeLabelmapIndex = state.brushStackState.activeLabelmapIndex
    const labelmap3D = state.brushStackState.labelmaps3D[activeLabelmapIndex];

    if (labelmap3D.metadata && labelmap3D.metadata.SOPInstanceUID) {
      //segmentation
      console.log('file is stored in pacs and ready for downloading');
    } else {
      //segmentation is not saved in pacs so it has to generated first
      console.log('segmentation file needs to be generated');
    }

    const segBlob = generateSegmentationBlob();
    window.open(URL.createObjectURL(segBlob));

  }







  // create dicom-seg and upload to pacs
  const uploadSegmentation = () => {
    const activeViewport = viewports[activeIndex]
    const studyId = activeViewport.StudyInstanceUID

    const enabledElements = cornerstone.getEnabledElements()
    const element = enabledElements[activeIndex].element
    const { getters } = cornerstoneTools.getModule('segmentation');

    const activeLabelMapIndex = getters.activeLabelmapIndex(element);

    if (typeof activeLabelMapIndex === 'undefined') {
      console.log('no labelmap3D')
      return null;
    }

    const labelmap3D = getters.labelmap3D(element, activeLabelMapIndex);

    let overwrite = false;
    let SOPInstanceUID = labelmap3D.metadata.SOPInstanceUID || '';
    if (SOPInstanceUID) {
      overwrite = true;
    }


    const segBlob = generateSegmentationBlob();
    const uploadSegmentationsUrl = configuration.uploadSegmentationsUrl;
    const XHR = new XMLHttpRequest()
    let fd = new FormData()

    fd.append('file', segBlob)
    fd.append('studyId', studyId)
    fd.append('overwrite', overwrite)
    fd.append('SOPInstanceUID', SOPInstanceUID)

    //const aditionalFields = { 'toolState': JSON.stringify(toolState), 'studyId': studyId }
    //add aditional fields to the form
    // Object.entries(aditionalFields).map(([key, value]) => {
    //   fd.append(key, value)
    // })

    XHR.onreadystatechange = function () {
      if (XHR.readyState == XMLHttpRequest.DONE) {
        const response = JSON.parse(XHR.responseText);
        //update the new seriesUID and instanceUID in labelmap3D
        labelmap3D.metadata.SOPInstanceUID = response.SOPInstanceUID
        labelmap3D.metadata.seriesInstanceUid = response.SeriesInstanceUID
        alert(response.msg);
      }
    }
    XHR.addEventListener(' error', function (event) {
      alert('Oops! Something went wrong.')
    });
    XHR.open('POST', `${uploadSegmentationsUrl}`)
    // Send our FormData object; HTTP headers are set automatically
    XHR.send(fd)
  }






  // create dicom-seg and upload to pacs
  const editSegmentation = () => {
    const currentLabelMap = state.labelmapList.find(
      i => i.value === state.selectedSegmentation
    );

    if (typeof currentLabelMap === 'undefined') {
      console.warn("couldn't find current label map. Aborting...");
      return;
    }
    const currentValue = currentLabelMap.title;

    dialogFunction('Segmentation Title', 'Series Description', currentValue, (newValue) => {
      const enabledElements = cornerstone.getEnabledElements()
      const element = enabledElements[activeIndex].element //activeIndex instead of 0 ??
      const module = cornerstoneTools.getModule('segmentation');
      const activeLabelmapIndex = module.getters.activeLabelmapIndex(element);

      if (typeof activeLabelmapIndex === 'undefined') {
        return;
      }
      const activeLabelmap = module.getters.labelmap3D(element, activeLabelmapIndex)
      activeLabelmap.metadata.SeriesDescription = newValue;

      //state.brushStackState.labelmaps3D[activeLabelmapIndex].metadata.SeriesDescription = 'modifie';
      updateState('brushStackState', module.getters.labelmaps3D(element));
      return;
    })
  }





  const disabledConfigurationFields = [
    'outlineAlpha',
    'shouldRenderInactiveLabelmaps',
  ];
  if (state.showSettings) {
    return (
      <SegmentationSettings
        disabledFields={isVTK() ? disabledConfigurationFields : []}
        configuration={configuration}
        onBack={() => updateState('showSettings', false)}
        onChange={updateConfiguration}
      />
    );
  } else {
    return (
      <div
        className={`dcmseg-segmentation-panel ${state.isDisabled &&
          'disabled'}`}
      >
        <div className="segmentations-header">
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
          <h3>Segmentations
            <Icon
              className="plus-icon button-icon"
              name="plus"
              width="20px"
              height="20px"
              onClick={() => addSegmentation(state)}
            />

          </h3>
          <Icon
            className="cog-icon button-icon"
            name="cog"
            width="25px"
            height="25px"
            onClick={() => updateState('showSettings', true)}
          />
        </div>
        <div className="segmentations">
          <SegmentationSelect
            value={state.labelmapList.find(
              i => i.value === state.selectedSegmentation
            )}
            formatOptionLabel={SegmentationItem}
            options={state.labelmapList}
          />
        </div>
        {state.brushStackState && state.brushStackState.activeLabelmapIndex >= 0 && (
          <div className="Segmentation-control">
            <Icon
              className="edit-icon button-icon"
              name="edit"
              width="17px"
              height="17px"
              onClick={() => editSegmentation()}
            />

            <Icon
              className="save-regular-icon button-icon"
              name="save"
              width="17px"
              height="17px"
              onClick={() => downloadSegmentation()}
            />

            <Icon
              className="database-icon button-icon"
              name="database"
              title="sdffsd"
              width="17px"
              height="17px"
              onClick={() => uploadSegmentation()}
            />

          </div>
        )}
        {state.brushStackState && state.brushStackState.activeLabelmapIndex >= 0 && (
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
        )}
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
          className="plus-icon button-icon"
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
