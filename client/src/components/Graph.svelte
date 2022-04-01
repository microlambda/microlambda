<script lang="ts">
  import * as dagreD3 from 'dagre-d3';
  import * as d3 from 'd3';
  import { onMount } from 'svelte';
  import { graph } from '../store';
  import { logger } from '../logger';
  import { createEventDispatcher } from 'svelte';

  export let height = 200;
  export let width = 400;
  export let service;

  const dispatch = createEventDispatcher();
  let container, svg: HTMLElement;
  let nodes = [] = [];
  const log = logger.scope('<Graph/>');
  const findAllChildren = (toFocus: any) => {
    const renderNodes = new Set();
    const recursivelyAppendChildren = (name: string) => {
      const node = nodes.find(n => n.name === name);
      renderNodes.add(node);
      for (const child of node.children) {
        recursivelyAppendChildren(child);
      }
    };
    recursivelyAppendChildren(toFocus.name);
    log.debug('render', Array.from(renderNodes));
    return Array.from(renderNodes);
  }

  const renderGraph = () =>  {
    const g = new dagreD3.graphlib.Graph().setGraph({}).setDefaultEdgeLabel(function() { return {}; });
    // log.debug('To focus', service);
    const focusedService = nodes.find(n => n.name === service);
    log.debug('To focus', focusedService);
    if (!focusedService) {
      return;
    }
    const renderNodes = findAllChildren(focusedService);
    renderNodes.forEach((node, idx) => {
      // log.debug('[node]', idx, node.name);
      g.setNode(idx, { label: node.name });
    });
    g.nodes().forEach((v) => {
      const node = g.node(v);
      // Round the corners of the nodes
      node.rx = node.ry = 5;
      node.class = 'blue';
      // log.debug('Label ?', node.label);
      const _node = nodes.find(n => n.name === node.label);
      /**
       * $red: #e53935;
       $bright-red: #ff1744;
       $grey: #616161;
       $green: #43a047;
       $blue: #1565c0;
       */
      if (_node.port) {
        switch (_node.status) {
          case 4:
            node.style = 'fill: #e53935; stroke: white;';
            break;
          case 1:
          case 2:
            node.style = 'fill: #43a047; stroke: white;';
            break;
          case 0:
            node.style = 'fill: #1565c0; stroke: white;';
            break;
          default:
            node.style = 'fill: #616161; stroke: white;';
        }
      } else {
        switch (_node.typeChecked) {
          case 3:
            node.style = 'fill: #e53935; stroke: white;';
            break;
          case 2:
            node.style = 'fill: #43a047; stroke: white;';
            break;
          case 1:
            node.style = 'fill: #1565c0; stroke: white;';
            break;
          default:
            node.style = 'fill: #616161; stroke: white;';
        }
      }
    });
    renderNodes.forEach((node, idx) => {
      node.children.forEach((child) => {
        const childIdx = renderNodes.indexOf(nodes.find(n => n.name === child));
        // log.debug('[edge]', node.name, '@', idx, '->', child, '@', childIdx);
        g.setEdge(idx, childIdx);
      });
    });
    g.edges().forEach((v) => {
      const node = g.edge(v);
      node.style = 'fill: transparent; stroke: white;';
    });
    const render = new dagreD3.render();

    const _svg = d3.select("svg");
    if (svg) {
      svg.innerHTML = '';
    }
    const inner = _svg.append("g");

    // Set up zoom support
    const zoom = d3.zoom().on("zoom", function() {
      inner.attr("transform", d3.event.transform);
    });
    _svg.call(zoom);
    render(d3.select("svg g"), g);
    // Fit and center the graph
    log.debug('Container width', width);
    log.debug('Graph width', g.graph().width);
    log.debug('X factor', width / g.graph().width);
    log.debug('Y factor', height / g.graph().height);
    const initialScale = Math.min(0.8 * Math.min(width / g.graph().width, height / g.graph().height), 2);
    log.debug('Scale', initialScale);
    const initialTranslate = { x: 0.5 * (width - initialScale * g.graph().width), y: 0.5 * (height - initialScale * g.graph().height) };
    log.debug('Translate', initialTranslate);
    _svg.call(zoom.transform, d3.zoomIdentity.translate(initialTranslate.x, initialTranslate.y).scale(initialScale));
    //svg.attr('height', g.graph().height * initialScale + 40);
    const arrows = document.querySelectorAll('g.edgePath > defs > marker > path');
    arrows.forEach((elt) => elt.setAttribute('style', 'fill: white; stroke: white;'))
  }

  onMount(() => {
    dispatch('mounted', container);
    graph.subscribe((_nodes) => {
      nodes = [..._nodes.packages, ..._nodes.services];
      log.debug('Nodes updated', nodes.length);
      renderGraph();
    });
  });

  $: {
    log.debug('Size updated', {height, width});
    log.debug('Service updated', service);
    renderGraph();
  }

</script>

<style>
  #graph {
    padding: 30px;
    width: 100%;
    height: 100%;
  }
  svg {
    width: 100%;
    height: 100%;
  }
</style>

<div bind:this={container} style="{`height: ${height}px; width: ${width}px`}">
  <svg bind:this={svg}></svg>
</div>
