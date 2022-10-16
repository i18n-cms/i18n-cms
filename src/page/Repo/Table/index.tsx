import {
  memo,
  useEffect,
  HTMLProps,
  forwardRef,
  useCallback,
  useRef
} from 'react';
import { Flex, Spinner } from '@chakra-ui/react';

import { FixedSizeList, FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import {
  Droppable,
  DragDropContext,
  type DropResult
} from 'react-beautiful-dnd';

import { useAppDispatch, useAppSelector } from '../../../redux/store';
import useGetEditingRepoLocalByNs from '../hooks/useGetEditingRepoLocalByNs';
import {
  setLocalesDataByNamespace,
  reorderNamespaceIds
} from '../../../redux/editingRepoSlice';

import Row from './Row';
import TableRow from './component/TableRow';
import TableHead from './component/TableHead';

import { LIST_PADDING_BOTTOM } from '../constants';
import { CELL_HEIGHT } from '../../../constants';
import reorder from '../../../utils/reorder';
import EventBus, { CustomEvents } from '../../../utils/eventBus';

const Inner = forwardRef<HTMLDivElement, HTMLProps<HTMLDivElement>>(
  function Inner({ children, style, ...rest }, ref) {
    return (
      <div
        {...rest}
        style={{
          ...style,
          height: `${
            parseFloat(style?.height?.toString() || '0') + LIST_PADDING_BOTTOM
          }px`
        }}
        ref={ref}>
        <TableHead />
        {children}
      </div>
    );
  }
);

const LocaleTable = () => {
  const localeIds = useAppSelector(
    (state) => state.EditingRepoReducer.localeIds
  );
  const namespace = useAppSelector(
    (state) => state.EditingRepoReducer.selectedNamespace
  );
  const listSize = (namespace && localeIds[namespace]?.length) || 0;

  const dispatch = useAppDispatch();
  const getEditingRepoLocalByNs = useGetEditingRepoLocalByNs();

  const listRef = useRef<FixedSizeList>(null);

  useEffect(() => {
    const handleTableScrollEvent = (
      e: CustomEvent<CustomEvents['table_scroll_to_index']>
    ) => {
      requestAnimationFrame(() => {
        listRef.current?.scrollToItem(e.detail.index + 1);
      });
    };

    EventBus.on('table_scroll_to_index', handleTableScrollEvent);
    return () => {
      EventBus.remove('table_scroll_to_index', handleTableScrollEvent);
    };
  }, []);

  useEffect(() => {
    const fetchNamespaceData = async () => {
      if (!namespace) return;
      const data = await getEditingRepoLocalByNs({
        namespace: namespace
      });
      if (!data) return;
      dispatch(setLocalesDataByNamespace({ namespace, data }));
    };

    if (namespace && !localeIds[namespace]) {
      fetchNamespaceData();
    }
  }, [namespace, localeIds]);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      if (
        !result.destination ||
        !namespace ||
        result.source.index === result.destination.index
      ) {
        return;
      }

      const data = reorder(
        localeIds[namespace],
        result.source.index,
        result.destination.index
      );

      dispatch(reorderNamespaceIds({ data, namespace }));
    },
    [namespace, localeIds]
  );

  if (!namespace) return null;

  return (
    <Flex flexGrow={1} overflow="scroll">
      {localeIds[namespace] ? (
        <AutoSizer>
          {({ height, width }) => (
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable
                droppableId="droppable"
                mode="virtual"
                renderClone={(provided, snapshot, rubric) => (
                  <TableRow
                    provided={provided}
                    isDragging={snapshot.isDragging}
                    style={{ margin: 0 }}
                    localeId={localeIds[namespace][rubric.source.index]}
                    index={rubric.source.index}
                  />
                )}>
                {(provided) => (
                  <List
                    ref={listRef}
                    key={namespace}
                    height={height}
                    itemCount={listSize + 1}
                    itemSize={CELL_HEIGHT}
                    width={width}
                    innerElementType={Inner}
                    outerRef={provided.innerRef}>
                    {Row}
                  </List>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </AutoSizer>
      ) : (
        <Flex flex="1" alignItems="center" justifyContent="center">
          <Spinner />
        </Flex>
      )}
    </Flex>
  );
};

export default memo(LocaleTable);
