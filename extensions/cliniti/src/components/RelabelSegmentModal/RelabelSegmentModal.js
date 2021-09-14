import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './RelabelSegmentModal.css';
import { Icon } from '@ohif/ui';
import segCodes from './segCodes.js';




// const getPropsFromMetadata = (meta) => {
//   return !meta ? null : {
//     code: meta.CodeValue,
//     name: meta.CodeMeaning,
//     scheme: meta.CodingSchemeDesignator
//   }
// }



const RelabelSegmentModal = ({
  labelmap3D,
  segmentIndex,
  confirm,
  cancel,
  metadata = labelmap3D.metadata.data[segmentIndex] || {}
}) => {


  const metaCat = metadata.SegmentedPropertyCategoryCodeSequence;
  const metaType = metadata.SegmentedPropertyTypeCodeSequence;
  const metaMod = metadata.SegmentedPropertyTypeModifierCodeSequence;

  let segCat = null;
  let segType = null;
  let segMod = null;

  //find category from metadata in segcodes
  if (metaCat) {
    let segCatFound = segCodes.filter(segCode => (metaCat.CodeValue === segCode.code && metaCat.CodingSchemeDesignator === segCode.scheme));
    segCat = segCatFound.length ? segCatFound[0] : null
  }
  //if category is found on segCodes and there is a type in meta look for it as well
  if (segCat && metaType && segCat.types) {
    let segTypeFound = segCat.types.filter(segCode => (metaType.CodeValue === segCode.code && metaType.CodingSchemeDesignator === segCode.scheme));
    segType = segTypeFound.length ? segTypeFound[0] : null
  }
  //if category is found on segCodes and there is a type in meta look for it as well
  if (segType && metaMod && segType.modifier) {
    let segModFound = segType.modifier.filter(segCode => (metaMod.CodeValue === segCode.code && metaMod.CodingSchemeDesignator === segCode.scheme));
    segMod = segModFound.length ? segModFound[0] : null;
  }





  const getWarningMetadataNotFound = () => {
    const notFoundParts = [];
    if ((metaCat && !segCat)) {
      notFoundParts.push(`category "${metaCat.CodeMeaning}"`);
    }
    if ((metaType && !segType)) {
      notFoundParts.push(`property "${metaType.CodeMeaning}"`);
    }
    if ((metaMod && !segMod)) {
      notFoundParts.push(`modifier "${metaMod.CodeMeaning}"`);
    }
    if (!notFoundParts.length) {
      return null
    } else {
      if (notFoundParts.length === 1) {
        return `Unable to match ${notFoundParts[0]} from metadata with standard code values`
      } else if (notFoundParts.length === 2) {
        return `Unable to match ${notFoundParts[0]} and ${notFoundParts[1]} from metadata with standard code values`
      } else {
        return `Unable to match ${notFoundParts[0]}, ${notFoundParts[1]} and ${notFoundParts[2]} from metadata with standard code values`
      }
    }
  }





  const [state, setState] = useState({
    showWarningMetadataNotFound: getWarningMetadataNotFound(),
    selectedType: segCat,
    selectedSubtype: segType,
    selectedModifier: segMod,
    filteredText: '',
    label: metadata.SegmentLabel || null,
  });



  const updateState = (field, value) => {
    setState(state => ({ ...state, [field]: value }));
  };



  // console.log('inside relabel component')
  // console.log(state.selectedType)
  // console.log(metadata)



  //create a subtype array with no duplicates
  const allSubtypeList = (() => {
    let subtypeKeys = [];
    let allSubtypeObjs = [];
    segCodes.map(({ code, name, scheme, types }) => {
      if (types) {
        const typecode = code;
        types.map(({ code, name, scheme, modifier }) => {
          const key = `${typecode}_${code}`;

          //filter parent type
          if (state.selectedType && typecode !== state.selectedType.code) {
            return
          }

          if (!subtypeKeys.includes(key)) {
            subtypeKeys.push(key);
            allSubtypeObjs.push({ typecode, key, code, scheme, name, modifier })
          }
        })
      }
    })
    return allSubtypeObjs;
  })();




  //type item was clicked
  const onTypeChange = (typeObj) => {
    if (!state.selectedType) {
      updateState('selectedType', typeObj) //select
      updateState('selectedSubtype', null); //need to unselect whatever subtype may be selected because subtype may not belong to this parent
    } else {
      if (typeObj.code === state.selectedType.code) {
        updateState('selectedType', null) //unselect
      } else {
        updateState('selectedType', typeObj) //select
        updateState('selectedSubtype', null); //need to unselect whatever subtype may be selected because subtype may not belong to this parent
      }
    }
    updateState('selectedModifier', null);
  }


  //subtype item was clicked
  const onSubtypeChange = (subtypeObj) => {
    if (!state.selectedSubtype) {
      //select
      updateState('selectedSubtype', subtypeObj)
      const parentType = segCodes.filter(type => (type.code === subtypeObj.typecode))[0];
      updateState('selectedType', parentType);
    } else {
      if (subtypeObj.code === state.selectedSubtype.code) {
        updateState('selectedSubtype', null); //unselect
      } else {
        //select
        updateState('selectedSubtype', subtypeObj)
        const parentType = segCodes.filter(type => (type.code === subtypeObj.typecode))[0];
        updateState('selectedType', parentType);
      }
    }
    updateState('selectedModifier', null);
  }





  //subtype item was clicked
  const onModifierChange = (modObj) => {
    if (!state.selectedModifier) {
      updateState('selectedModifier', modObj);
    } else {
      if (modObj.code === state.selectedModifier.code) {
        updateState('selectedModifier', null); //unselect
      } else {
        //select
        updateState('selectedModifier', modObj)
      }
    }
  }


  const getDefaultLabel = () => {
    let typePart = `${(state.selectedType && state.selectedType.name) || 'other'}`.trim()
    let subtypePart = `${(state.selectedSubtype && state.selectedSubtype.name) || 'other'}`.trim()
    let modifierPart = `${(state.selectedModifier && state.selectedModifier.name) || segmentIndex}`.trim();
    return `${typePart} - ${subtypePart} - ${modifierPart}`;
  }




  return (
    <div className="relabel-modal">
      { state.showWarningMetadataNotFound && (
        <p className="show-warning-metadata-not-found">{state.showWarningMetadataNotFound}</p>
      )}
      <p className="warning-meta-not-found"></p>
      <div className="relabel-modal-content">


        <div className="type-container-column">
          <div className="label-container">
            <label lass="col-form-label">Category</label>
          </div>
          <div className="type-column">
            <ul className="list-group">


              {
                segCodes.map(({ code, name, scheme, types }) => {
                  return (
                    <li
                      className={`list-group-item list-type ${(state.selectedType && state.selectedType.code === code) ? 'selected' : ''}`}
                      key={code}
                      code={code}
                      scheme={scheme}
                      onClick={() => onTypeChange({ code, name, scheme })}
                    >
                      {name}
                    </li>
                  );
                })
              }


            </ul>
          </div>
        </div>

        <div className="subtype-container-column">

          <div className="subtype-input-group">
            <div className="subtype-label-container">
              <label lass="col-form-label">Property</label>
            </div>
            <div className="input-group-prepend">
              <span className="input-group-text">
                <Icon
                  className="search-icon"
                  name="search"
                  width="24px"
                  height="24px"
                />
              </span>
            </div>

            <input
              type="text"
              className="form-control"
              placeholder="search"
              value={state.filteredText}
              onChange={event => updateState('filteredText', event.target.value)}
            ></input>

          </div>

          <div className={`type-column ${state.selectedSubtype ? 'item-selected' : ''}`}>
            <ul className="list-group" style={{ marginTop: 0 }}>
              {
                allSubtypeList.map(({ typecode, key, code, name, scheme, modifier }) => {
                  //selected item sticks to the top list, not selected
                  const classSelected = state.selectedSubtype && state.selectedSubtype.code === code ? 'selected' : '';
                  const classNotSelected = state.selectedSubtype && state.selectedSubtype.code !== code ? 'unselected' : '';
                  let classDisabled = state.filteredText && !name.includes(state.filteredText) ? 'disabled' : '';
                  //ignore filter when the subtype is selected
                  if (state.selectedSubtype && state.selectedSubtype.code === code && classDisabled) {
                    classDisabled = '';
                  }

                  return (
                    <li
                      className={`list-group-item list-subtype ${classSelected} ${classDisabled}`}
                      typecode={typecode}
                      modifier={modifier}
                      key={key}
                      scheme={scheme}
                      code={code}
                      onClick={() => onSubtypeChange({ typecode, key, code, name, scheme, modifier })}

                    >
                      {name}
                    </li>

                  )
                })
              }
            </ul>
          </div>

        </div>

        <div className="modifier-container-column">
          <div className="label-container">
            <label lass="col-form-label">Modifier</label>
          </div>

          <div className="type-column">
            <ul className="list-group">
              {
                state.selectedSubtype && state.selectedSubtype.modifier && (
                  state.selectedSubtype.modifier.map(({ code, name, scheme }) => {
                    return (
                      <li
                        className={`list-group-item list-modifier ${(state.selectedModifier && state.selectedModifier.code === code) ? 'selected' : ''}`}
                        key={`modifier_${code}`}
                        onClick={() => onModifierChange({ code, name, scheme })}
                      >
                        {name}
                      </li>
                    )
                  })
                )
              }
            </ul>
          </div>
        </div>

      </div>

      <div className="relabel-modal-footer">

        <div className="segment-label-input-container">
          <label className="segment-label">Label</label>
          <input
            type="text"
            className="form-control segment-label-input"
            placeholder={getDefaultLabel()}
            value={state.label}
            onChange={event => updateState('label', event.target.value)}
          ></input>
        </div>


        <button
          className="btn btn-default"
          onClick={cancel}
        >
          Cancel
        </button>


        <button
          className={`btn btn-primary`}
          disabled={!state.selectedType || !state.selectedSubtype}
          onClick={
            () => {
              let type = state.selectedType ? { code: state.selectedType.code, name: state.selectedType.name, scheme: state.selectedType.scheme } : null;
              let subtype = state.selectedSubtype ? { code: state.selectedSubtype.code, name: state.selectedSubtype.name, scheme: state.selectedSubtype.scheme } : null;
              let modifier = state.selectedModifier ? { code: state.selectedModifier.code, name: state.selectedModifier.name, scheme: state.selectedModifier.scheme } : null;
              let label = state.label || getDefaultLabel();

              confirm({ type, subtype, modifier, label })
            }
          }
        >
          Confirm
        </button>


      </div>

    </div>
  );
};


RelabelSegmentModal.propTypes = {
  labelmap3D: PropTypes.object.isRequired,
  segmentIndex: PropTypes.number.isRequired,
  confirm: PropTypes.func.isRequired,
  cancel: PropTypes.func.isRequired
};


export default RelabelSegmentModal;
