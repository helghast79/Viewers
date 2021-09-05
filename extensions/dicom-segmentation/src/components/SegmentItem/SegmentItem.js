import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { TableListItem, Icon } from '@ohif/ui';
import ReactTooltip from 'react-tooltip';

import './SegmentItem.css';

const ColoredCircle = ({ color }) => {
  return (
    <div
      className="segment-color"
      style={{ backgroundColor: `rgba(${color.join(',')})` }}
    ></div>
  );
};

ColoredCircle.propTypes = {
  color: PropTypes.array.isRequired,
};

const SegmentItem = ({
  index,
  label,
  onClick,
  itemClass,
  color,
  visible = true,
  onVisibilityChange,
  dialogFunction,
  relabelSegmentModal,
  deleteDialogFunction,
  metadata
}) => {
  const [isVisible, setIsVisible] = useState(visible);

  useEffect(() => {
    setIsVisible(visible);
  }, [visible]);


  const getDescription = segmentProps => {
    const parts = [];
    if (segmentProps.type) parts.push(segmentProps.type.name)
    if (segmentProps.subtype) parts.push(segmentProps.subtype.name)
    if (segmentProps.modifier) parts.push(segmentProps.modifier.name)
    return parts.join(' - ');
  }

  const convertMetaToProps = metadata => {
    const props = {};
    if (metadata) {
      if (metadata.SegmentedPropertyCategoryCodeSequence) {
        props.type = {
          code: metadata.SegmentedPropertyCategoryCodeSequence.CodeValue,
          scheme: metadata.SegmentedPropertyCategoryCodeSequence.CodingSchemeDesignator,
          name: metadata.SegmentedPropertyCategoryCodeSequence.CodeMeaning
        }
      }
      if (metadata.SegmentedPropertyTypeCodeSequence) {
        props.subtype = {
          code: metadata.SegmentedPropertyTypeCodeSequence.CodeValue,
          scheme: metadata.SegmentedPropertyTypeCodeSequence.CodingSchemeDesignator,
          name: metadata.SegmentedPropertyTypeCodeSequence.CodeMeaning
        }
      }
      if (metadata.SegmentedPropertyTypeModifierCodeSequence) {
        props.modifier = {
          code: metadata.SegmentedPropertyTypeModifierCodeSequence.CodeValue,
          scheme: metadata.SegmentedPropertyTypeModifierCodeSequence.CodingSchemeDesignator,
          name: metadata.SegmentedPropertyTypeModifierCodeSequence.CodeMeaning
        }
      }
    }
    return props
  }



  const segmentProps = convertMetaToProps(metadata);
  const description = getDescription(segmentProps);


  return (
    <div className="dcmseg-segment-item">
      <TableListItem
        key={index}
        itemKey={index}
        itemIndex={index}
        itemClass={itemClass}
        itemMeta={<ColoredCircle color={color} />}
        itemMetaClass="segment-color-section"
        onItemClick={onClick}
      >
        <div>
          <div className="segment-label" style={{ marginBottom: 4 }}>
            <a data-tip data-for={`SegmentHover${index}`}>
              <span>{label}</span>
            </a>
            <ReactTooltip
              id={`SegmentHover${index}`}
              delayShow={250}
              place="right"
              border={true}
              type="light"
            >
              <span>{label}</span>
            </ReactTooltip>
            <Icon
              className={`eye-icon ${isVisible && '--visible'}`}
              name={isVisible ? 'eye' : 'eye-closed'}
              width="20px"
              height="20px"
              onClick={event => {
                event.stopPropagation();
                const newVisibility = !isVisible;
                setIsVisible(newVisibility);
                onVisibilityChange(newVisibility);
              }}
            />
          </div>
          {true && (
            <div className="segment-info">
              <a data-tip data-for={`SegmentInfoHover${index}`}>
                <span>{description}</span>
              </a>
              <ReactTooltip
                id={`SegmentInfoHover${index}`}
                delayShow={150}
                place="right"
                border={true}
                type="light"
              >
                {segmentProps.type && (<p><span style={{ color: "#337ab7" }}>Category: </span>{`${segmentProps.type.name} - ${segmentProps.type.code} (${segmentProps.type.scheme})`}</p>)}
                {segmentProps.subtype && (<p><span style={{ color: "#337ab7" }}>Type:  </span>{`${segmentProps.subtype.name} - ${segmentProps.subtype.code} (${segmentProps.subtype.scheme})`}</p>)}
                {segmentProps.modifier && (<p><span style={{ color: "#337ab7" }}>Modifier: </span>{`${segmentProps.modifier.name} - ${segmentProps.modifier.code} (${segmentProps.modifier.scheme})`}</p>)}
              </ReactTooltip>
            </div>
          )}
          {true && (
            <div className="segment-actions">
              <button
                className="btnAction"
                onClick={(event) => {
                  event.stopPropagation();
                  relabelSegmentModal();
                  //dialogFunction('ok', '', 'test relabel', (n) => { console.log(`relabel ${index}`) })
                }}
              >
                <span style={{ marginRight: '4px' }}>
                  <Icon name="edit" width="14px" height="14px" />
                </span>
                Relabel
              </button>

              <button
                className="btnAction"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteDialogFunction();
                }}
              >
                <span style={{ marginRight: '4px' }}>
                  <Icon name="trash" width="14px" height="14px" />
                </span>
                Delete
              </button>
            </div>
          )}
        </div>
      </TableListItem>
    </div>
  );
};

SegmentItem.propTypes = {
  index: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func,
  itemClass: PropTypes.string,
  color: PropTypes.array.isRequired,
  metadata: PropTypes.object,
};

SegmentItem.defaultProps = {
  itemClass: '',
  onClick: () => { },
};

export default SegmentItem;
