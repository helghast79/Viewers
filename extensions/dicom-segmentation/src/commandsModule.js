//import cornerstone from 'cornerstone-core';
//import cornerstoneTools from 'cornerstone-tools';
import OHIF from '@ohif/core';
//import dcmjs from './dcmjs_debug';
//import dcmjs from 'dcmjs';
//import dicomParser from 'dicom-parser';

// import setCornerstoneLayout from './utils/setCornerstoneLayout.js';
// import { getEnabledElement } from './state';
// import CornerstoneViewportDownloadForm from './CornerstoneViewportDownloadForm';
// const scroll = cornerstoneTools.import('util/scroll');

const { studyMetadataManager, DicomLoaderService } = OHIF.utils;
const { setViewportSpecificData } = OHIF.redux.actions;


// "actions" doesn't really mean anything
// these are basically ambigous sets of implementation(s)
const actions = {
  doGoofyStuff: async () => {

    console.log('~~ GOOFY');

  },
};

const definitions = {
  doGoofyStuff: {
    commandFn: actions.doGoofyStuff,
    storeContexts: [],
    // options: { rotation: 90 },
  },
};

export default {
  actions,
  definitions,
  defaultContext: 'ACTIVE_VIEWPORT::CORNERSTONE',
};
