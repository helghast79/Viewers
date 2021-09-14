import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import cornerstoneTools from 'cornerstone-tools';
import cornerstone from 'cornerstone-core';
import moment from 'moment';
import { utils, log } from '@ohif/core';
import { ScrollableArea, TableList, Icon, SimpleDialog, Dropdown } from '@ohif/ui';
import ReactTooltip from 'react-tooltip';
import DICOMSegTempCrosshairsTool from '../../tools/DICOMSegTempCrosshairsTool';


import setActiveLabelmap from '../../utils/setActiveLabelMap';
import refreshViewports from '../../utils/refreshViewports';

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
    showSegmentationSettings: false,
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

    //dosen't make sense here because it will only be created when the panel is open
    // document.addEventListener(
    //   'extensiondicomsegmentationsegloaded',
    //   refreshSegmentations
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
      // document.removeEventListener(
      //   'extensiondicomsegmentationsegloaded',
      //   refreshSegmentations
      // );

      cornerstoneTools.store.state.enabledElements.forEach(enabledElement =>
        enabledElement.removeEventListener(
          'cornerstonetoolslabelmapmodified',
          labelmapModifiedHandler
        )
      );
    };
  }, [
    activeIndex,
    updateSegmentationComboBox,
    viewports,
    state.brushStackState
  ]);




  const updateSegmentationComboBox = e => {
    const index = e.detail.activatedLabelmapIndex;
    if (index !== -1) {
      setState(state => ({ ...state, selectedSegmentation: index }));
    } else {
      cleanSegmentationComboBox();
    }
  };

  const cleanSegmentationComboBox = () => {
    setState(state => ({
      ...state,
      segmentsHidden: [],
      segmentNumbers: [],
      labelMapList: [],
      segmentList: [],
      isDisabled: true,
      selectedSegmentation: -1,
    }));
  };



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

      const filteredReferencedSegDisplaysets = referencedSegDisplaysets.filter(
        segDisplay => segDisplay.loadError !== true
      );

      let labelmapList = [];

      //get labelMapList from referecedDisplaySets
      labelmapList = filteredReferencedSegDisplaysets.map((displaySet, index) => {

        const { labelmapIndex, SeriesDescription, SeriesDate, SeriesTime } = displaySet;

        /* Map to display representation */
        const dateStr = `${SeriesDate}:${SeriesTime}`.split('.')[0];
        const date = moment(dateStr, 'YYYYMMDD:HHmmss');
        const isActiveLabelmap =
          labelmapIndex === brushStackState.activeLabelmapIndex;
        const displayDate = date.format('ddd, MMM Do YYYY');
        const displayTime = date.format('h:mm:ss a');

        let displayDescription = SeriesDescription
        if (brushStackState &&
          brushStackState.labelmaps3D &&
          brushStackState.labelmaps3D[labelmapIndex] &&
          brushStackState.labelmaps3D[labelmapIndex].metadata &&
          brushStackState.labelmaps3D[labelmapIndex].metadata.SeriesDescription) {
          displayDescription = brushStackState.labelmaps3D[labelmapIndex].metadata.SeriesDescription
        }
        //const displayDescription = brushStackState.labelmaps3D[labelmapIndex].metadata.SeriesDescription; //displaySet.SeriesDescription;
        //const displayDescription = SeriesDescription;

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
        if (i < filteredReferencedSegDisplaysets.length) {
          return true;
        }

        if (!labelMap3D.metadata.SeriesDescription) {
          labelMap3D.metadata.SeriesDescription = '(no description set)'
        }

        const todayDate = moment(new Date(), 'YYYYMMDD:HHmmss');
        const description = todayDate.format('ddd, MMM Do YYYY');
        const title = labelMap3D.metadata.SeriesDescription;

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
            const segmentIndexes = labelmap2D.segmentsOnLabelmap; //ex: [0, 4, 1, 3, 2] //0 is not a segment and it's always there

            for (let i = 0; i < segmentIndexes.length; i++) {
              if (!acc.includes(segmentIndexes[i]) && segmentIndexes[i] !== 0) {
                acc.push(segmentIndexes[i]);
              }
            }
          }

          return acc;
        }, [])
        .sort((a, b) => a - b); //ex: [1, 2, 3, 4]

      const module = cornerstoneTools.getModule('segmentation');
      const colorLutTable = module.state.colorLutTables[labelmap3D.colorLUTIndex];
      const hasLabelmapMeta = labelmap3D.metadata && labelmap3D.metadata.data;

      const segmentList = [];
      for (let i = 0; i < uniqueSegmentIndexes.length; i++) {
        const segmentIndex = uniqueSegmentIndexes[i];
        const color = colorLutTable[segmentIndex];

        let segmentLabel = '(unlabeled)';
        let segmentNumber = segmentIndex;
        let segmentMetadata = {};
        /* Meta */
        if (hasLabelmapMeta) {
          const segmentMeta = labelmap3D.metadata.data[segmentIndex];

          if (segmentMeta) {
            segmentNumber = parseInt(segmentMeta.SegmentNumber);
            segmentLabel = segmentMeta.SegmentLabel;
            segmentMetadata = segmentMeta;

            //load color from metadata if it's defined
            // if (segmentMeta.RecommendedDisplayCIELabValue) {
            //   //dicomlab2RGB outputs sRGB -> [{0-1},{0-1},{0-1}] but we need RGB -> [{0-255},{0-255},{0-255}]
            //   color = dcmjs.data.Colors.dicomlab2RGB(segmentMeta.RecommendedDisplayCIELabValue).map(rgb => Math.round(rgb * 255));
            //   color = [...color, 255];
            //   //this will set the color of the labelmap while color variable above will define the color of segment item component
            //   module.setters.colorForSegmentIndexOfColorLUT(labelmap3D.colorLUTIndex, segmentNumber, color)
            // }
          }
        }

        const sameSegment = state.selectedSegment === segmentNumber;

        const setCurrentSelectedSegment = () => {

          _setActiveSegment(
            firstImageId,
            segmentNumber,
            labelmap3D.activeSegmentIndex
          );
          updateState('selectedSegment', segmentNumber) //sameSegment ? null : segmentNumber);

          if (!sameSegment) {
            updateActiveSegmentColor()
          }

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

        const selectedClass = (state.selectedSegment === segmentNumber ? 'selected' : '')

        //turn relabel segment props into dicom standard tag labels (dcmjs will convert these into P10 tags)
        const convertSegmentPropsToMetadata = ({ type, subtype, modifier, label }) => {
          const metadata = {};
          if (type) {
            metadata.SegmentedPropertyCategoryCodeSequence = {
              CodeValue: type.code,
              CodingSchemeDesignator: type.scheme,
              CodeMeaning: type.name
            }
          }
          if (subtype) {
            metadata.SegmentedPropertyTypeCodeSequence = {
              CodeValue: subtype.code,
              CodingSchemeDesignator: subtype.scheme,
              CodeMeaning: subtype.name
            }
          }
          if (modifier) {
            metadata.SegmentedPropertyTypeModifierCodeSequence = {
              CodeValue: modifier.code,
              CodingSchemeDesignator: modifier.scheme,
              CodeMeaning: modifier.name
            }
          }

          metadata.SegmentLabel = label;
          return metadata;
        }

        const updateSegmentMetadata = ({ type, subtype, modifier, label }) => {
          const metadata = convertSegmentPropsToMetadata({ type, subtype, modifier, label });

          labelmap3D.metadata.data[segmentNumber] = { ...labelmap3D.metadata.data[segmentNumber], ...metadata }
          labelmap3D.metadata.data[segmentNumber].SegmentNumber = segmentNumber;
          // labelmap3D.metadata.data[segmentNumber].RecommendedDisplayCIELabValue =  RecommendedDisplayCIELabValue: dcmjs.data.Colors.dicomlab2RGB([
          //   1,
          //   0,
          //   0
          // ]),

          const updatedBrushStackState = { ...brushStackState }
          updatedBrushStackState.labelmaps3D[brushStackState.activeLabelmapIndex] = labelmap3D;

          updateState('brushStackState', updatedBrushStackState);
        }

        const deleteSegment = () => {
          const enabledElements = cornerstone.getEnabledElements();
          const element = enabledElements[activeIndex].element;


          module.setters.deleteSegment(element, segmentNumber);
          refreshSegmentations()
        }


        segmentList.push(
          <SegmentItem
            key={segmentNumber}
            itemClass={`segment-item ${selectedClass}`}
            onClick={() => setCurrentSelectedSegment()}
            label={segmentLabel}
            metadata={segmentMetadata}
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
            dialogFunction={dialogFunction}
            relabelSegmentModal={() => { return relabelSegmentModal(labelmap3D, segmentNumber, updateSegmentMetadata) }}
            deleteDialogFunction={() => { return deleteDialogFunction('Delete Segment', `Segment [ ${segmentNumber} ] - "${segmentLabel}" will be erased...`, deleteSegment) }}
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
    [
      activeIndex,
      onSegmentItemClick,
      state.selectedSegment,
      state.isLoading
    ]
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
  const addSegmentation = async (state) => {

    const activeViewport = viewports[activeIndex];
    const studyMetadata = studyMetadataManager.get(
      activeViewport.StudyInstanceUID
    );

    //      not needed for now but keeping it for future reference
    const referencedStudy = studies.find(study => study.StudyInstanceUID === activeViewport.StudyInstanceUID)
    const referecedDisplaySet = referencedStudy.displaySets.find(displaySet => displaySet.displaySetInstanceUID === activeViewport.displaySetInstanceUID)
    const referencedSeries = referencedStudy.series.find(series => series.SeriesInstanceUID === activeViewport.SeriesInstanceUID)
    const firstReferencedInstance = referencedSeries.instances[0]


    const enabledElements = cornerstone.getEnabledElements()
    const element = enabledElements[activeIndex].element

    const stackToolState = cornerstoneTools.getToolState(element, "stack");
    const imageIds = stackToolState.data[0].imageIds;
    const firstImageId = imageIds[0];

    let imagePromises = [];
    for (let i = 0; i < imageIds.length; i++) {
      imagePromises.push(
        cornerstone.loadImage(imageIds[i])
      );
    }
    //get images and the total size in bytes
    const images = await Promise.all(imagePromises)
    const overallSize = images.reduce((acc, image) => acc += image.sizeInBytes, 0)
    //create a new labelMapBuffer with the same size as the reference study images
    const labelmapBuffer = new Uint16Array(overallSize)

    const module = cornerstoneTools.getModule('segmentation')
    //this will be undefined if there are not labelmaps loaded
    const labelmaps3D = module.getters.labelmaps3D(element).labelmaps3D
    //set the index of the new labelmap, 0 if no labelmaps created yet
    let labelmapIndex = 0
    if (typeof labelmaps3D !== 'undefined') {
      labelmapIndex = labelmaps3D.length
    }

    //get default value for SeriesDescription and SeriesNumber (SeriesDescription is editable afterwards )
    let newSeriesNumber = 1,
      newSegSeriesNumber = 1

    //get the largest series number in this study
    for (const s of studies[0].series) {
      if (s.SeriesNumber >= newSeriesNumber) {
        newSeriesNumber = +s.SeriesNumber + 1
      }
    }

    //if there are labelmaps3D set the newSegSeriesNumber & newSeriesNumber +1 of existing
    if (labelmaps3D) {
      //check also the series number from the labelMaps3D (they may have segmentations not saved yet and so not present in studies.series)
      for (const labelMap3D of labelmaps3D) {
        if (labelMap3D.metadata.seriesNumber >= newSeriesNumber) {
          newSeriesNumber = +labelMap3D.metadata.seriesNumber + 1
        }
      }

      newSegSeriesNumber = +labelmaps3D.length + 1
    }

    const segMetadata = {
      data: [],
      seriesInstanceUid: cornerstone.metaData.get('SeriesInstanceUID', firstImageId),
      rleEncode: false,
      SeriesDescription: `Segmetation #${newSegSeriesNumber}`,
      SeriesNumber: newSeriesNumber,
      ImageComments: 'RESEARCH',
      Manufacturer: "Cliniti",
      PatientName: referencedStudy.PatientName
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
    const globalToolStateManager = cornerstoneTools.globalImageIdSpecificToolStateManager;
    const toolState = globalToolStateManager.saveToolState();

    const stackToolState = cornerstoneTools.getToolState(element, "stack");
    const imageIds = stackToolState.data[0].imageIds;

    const { getters } = cornerstoneTools.getModule('segmentation');

    const activeLabelMapIndex = getters.activeLabelmapIndex(element); //will get the active segmentation for an elment

    //const labelmap3D = getters.labelmap3D(element, activeLabelMapIndex);
    const labelmaps3D = getters.labelmaps3D(element).labelmaps3D;

    if (!labelmaps3D.length) {
      console.log('no labelmaps3D')
      return null;
    }

    let correctedLabelMaps3d = [];

    for (const labelmap3D of labelmaps3D) {

      let correctedLabelMap;
      //correct nested metadata in labelmaps3D (required metadata is actually inside data prop in metadata)
      if (labelmap3D.metadata.data) {
        correctedLabelMap = { ...labelmap3D, metadata: labelmap3D.metadata.data };
      } else {
        correctedLabelMap = { ...labelmap3D }
      }

      correctedLabelMaps3d.push(correctedLabelMap)
    }
    //console.log(correctedLabelMaps3d); return;
    //get the next available series number
    let seriesNumber = 1,
      segSeriesNumber = 1

    for (const s of studies[0].series) {
      if (s.Modality === 'SEG') {
        segSeriesNumber++
      }
      if (s.SeriesNumber >= seriesNumber) {
        seriesNumber = +s.SeriesNumber + 1
      }
    }

    //save some data to tag fields by passing acepted fields by DCMJS (check DerivedDataset line 5434 of dcmjModified.js)
    let options = {
      rleEncode: false,
      SeriesDescription: `Segmetation #${segSeriesNumber}`,
      SeriesNumber: seriesNumber,
      ImageComments: 'RESEARCH',
      Manufacturer: "Cliniti",//use username from clinity exposed in window
    }


    // console.log('==============================<>>>>>>>>>>>>', correctedLabelMaps3d, studies)
    // return;

    // if (!labelmap3D) {
    //   console.log('no labelmap3D')
    //   return null;
    // }

    // //save some data to tag fields by passing acepted fields by DCMJS (check DerivedDataset line 5434 of dcmjModified.js)
    // let options = {
    //   SeriesDescription: labelmap3D.metadata.SeriesDescription,
    //   SeriesNumber: +activeLabelMapIndex + 1,
    //   ImageComments: 'RESEARCH',
    //   Manufacturer: "Dr. Who",//use username from clinity exposed in window
    // }

    // let correctedLabelMap;
    // //correct nested metadata in labelmaps3D (required metadata is actually inside data prop in metadata)
    // if (labelmap3D.metadata.data) {
    //   correctedLabelMap = { ...labelmap3D, metadata: labelmap3D.metadata.data };
    // } else {
    //   correctedLabelMap = { ...labelmap3D }
    // }

    // let correctedLabelMaps3d = [];

    // correctedLabelMaps3d.push(correctedLabelMap)

    const isMultiframe = imageIds[0].includes("?frame")

    let datasets = []

    if (isMultiframe) {
      datasets.push(cornerstone.metaData.get('instance', imageId[0]))

    } else {
      imageIds.forEach(imageId => {
        let instance = cornerstone.metaData.get('instance', imageId)
        instance._meta = [] //array needs to be present
        datasets.push(instance)
        //datasets.push(cornerstone.metaData.get('instance', imageId))
      });
    }

    const segBlob = dcmjs.adapters.Cornerstone.Segmentation.generateSegmentationFromDatasets(
      datasets,
      correctedLabelMaps3d[activeLabelMapIndex], //if we send all segmentations they will all be collapsed into 1 (overlaping segments not working??)
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
    const activeLabelmapIndex = state.brushStackState.activeLabelmapIndex
    const labelmap3D = state.brushStackState.labelmaps3D[activeLabelmapIndex];

    console.log('---->', currentLabelMap, labelmap3D)
    const currentValue = currentLabelMap.title;

    dialogFunction('Segmentation Title', 'Series Description', currentValue, (newValue) => {
      const enabledElements = cornerstone.getEnabledElements()
      const element = enabledElements[activeIndex].element
      const module = cornerstoneTools.getModule('segmentation');
      const activeLabelmapIndex = module.getters.activeLabelmapIndex(element);

      if (typeof activeLabelmapIndex === 'undefined') {
        return;
      }
      const activeLabelmap = module.getters.labelmap3D(element, activeLabelmapIndex)
      activeLabelmap.SeriesDescription = newValue;
      activeLabelmap.metadata.SeriesDescription = newValue;

      //state.brushStackState.labelmaps3D[activeLabelmapIndex].metadata.SeriesDescription = 'modifie';
      updateState('brushStackState', module.getters.labelmaps3D(element));
      return;
    })
  }



  const renderCustomDropdownTitle = (iconName, title) => {

    return (
      <React.Fragment>
        <span className="dropdown-custom-icon">
          <Icon
            className={`${iconName}-icon button-icon`}
            name={iconName}
            width="17px"
            height="17px"
          />
        </span>
        {/* <span className="dropdown-custom-title">
          {title}
        </span>
        <span className="dd-caret-down" />*/}

      </React.Fragment>
    );
  };


  const dropdownSegmentationFileOptions = () => {
    return [
      {
        title: 'Download segmentation',
        // icon: {
        //   name: 'edit',
        // },
        onClick: downloadSegmentation
      },
      {
        title: 'Upload segmentation to pacs',
        onClick: uploadSegmentation
      },
      {
        title: 'Delete segmentation from pacs',
        // onClick: uploadSegmentation()
      },
    ]
  }







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
          </h3>
          <Icon
            className="cog-icon button-icon"
            name="cog"
            width="25px"
            height="25px"
            onClick={() => updateState('showSegmentationSettings', true)}
          />
        </div>
        <div className="segmentations">

          <div
            className="segmentation-select-add-button"
            data-tip
            data-for="new-segmentation-button"
            onClick={() => addSegmentation(state)}
          >
            <Icon
              className="plus-icon button-icon"
              name="plus"
              width="20px"
              height="20px"

            />
            <ReactTooltip
              id="new-segmentation-button"
              delayShow={250}
              place="top"
              border={true}
              type="light"
            >
              <span>Add new segmentation</span>
            </ReactTooltip>
          </div>
          <div className="segmentation-select-input">
            <SegmentationSelect
              value={state.labelmapList.find(
                i => i.value === state.selectedSegmentation
              )}
              formatOptionLabel={SegmentationItem}
              options={state.labelmapList}
            />
          </div>
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

            <div className="custom-dropdown segmentation-file-dropdown">
              <Dropdown
                titleElement={renderCustomDropdownTitle('bars', 'File')}
                align="right"
                list={dropdownSegmentationFileOptions()}
              ></Dropdown>
            </div>

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
