import {
  memo,
  useEffect,
  HTMLProps,
  forwardRef,
  useCallback,
  useRef,
  useMemo
} from 'react';
import { Flex, Spinner, Text, useBreakpointValue } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
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

import {
  currentLocaleIdsSelector,
  duplicatedKeysSelectorMap,
  duplicatedKeysSelectorFactory
} from '../../../redux/selector';

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

const Outer = forwardRef<HTMLDivElement, HTMLProps<HTMLDivElement>>(
  function Outer({ children, style, ...rest }, ref) {
    const isMobile = useBreakpointValue({ base: true, md: false });
    return (
      <div
        {...rest}
        data-e2e-id="table_container"
        style={{
          ...style,
          overflowX: isMobile ? 'hidden' : 'auto'
        }}
        ref={ref}>
        {children}
      </div>
    );
  }
);

const LocaleTable = () => {
  const { t: repoT } = useTranslation('repo');

  const localeIds = useAppSelector(
    (state) => state.EditingRepoReducer.localeIds
  );
  const namespace = useAppSelector(
    (state) => state.EditingRepoReducer.selectedNamespace || ''
  );
  const currentLocaleIds = useAppSelector(currentLocaleIdsSelector);

  const duplicatedKeysSelector = useMemo(() => {
    if (!duplicatedKeysSelectorMap[namespace])
      duplicatedKeysSelectorMap[namespace] =
        duplicatedKeysSelectorFactory(namespace);
    return duplicatedKeysSelectorMap[namespace];
  }, [namespace]);

  const duplicatedKeys = useAppSelector(duplicatedKeysSelector);
  const listSize = currentLocaleIds.length;

  const dispatch = useAppDispatch();
  const getEditingRepoLocalByNs = useGetEditingRepoLocalByNs();

  const listRef = useRef<FixedSizeList>(null);
  const itemData = useMemo(() => ({ duplicatedKeys }), [duplicatedKeys]);

  useEffect(() => {
    const handleTableScrollEvent = (
      e: CustomEvent<CustomEvents['table_scroll_to_index']>
    ) => {
      requestAnimationFrame(() => {
        listRef.current?.scrollToItem(e.detail.index + 1, e.detail.align);
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

  if (!namespace)
    return (
      <Flex
        flexGrow={1}
        align="center"
        justifyContent="center"
        p="4"
        textAlign="center">
        <Text fontSize="1xl" fontWeight="semibold">
          {repoT('Choose namespace you want to edit')}
        </Text>
      </Flex>
    );

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
                    localeId={currentLocaleIds[rubric.source.index]}
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
                    outerElementType={Outer}
                    itemData={itemData}
                    outerRef={provided.innerRef}>
                    {Row}
                  </List>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </AutoSizer>
      ) : (
        <Flex
          data-e2e-id="table_spinner"
          flex="1"
          alignItems="center"
          justifyContent="center">
          <Spinner />
        </Flex>
      )}
    </Flex>
  );
};

export default memo(LocaleTable);
