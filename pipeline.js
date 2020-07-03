const pipeline = options => {
    _.defaultsDeep(options, {
        continuity: true,
        types: {
            enter: [],
            exit: [],
            color: {
                "normal": "#888"
            },
            captionColor: {}
        },
        grid: {
            padding: 20,
            cellWidth: 160,
            cellHeight: 160,
            timespanGapHeight: 20,
            linkCellGapWidth: 30,
            color: "#eee",
            labelColor: "#666",
            fontSize: 14,
            timespanLabelMargin: 20,
            stageLabelMargin: 15,
            foregroundColor: "white",
            foregroundFade: 0.8
        },
        link: {
            width: 4,
            gapWidth: 1,
            groupGapWidth: 6,
            straightSegmentHeight: 30,
            opacity: 0.4,
            dimmedOpacity: 0.2,
            highlightedOpacity: 1
        },
        caption: {
            spaghettiCaptionSize: 16,
            spaghettiCaptionGapHeight: 2,
            sankeyCaptionMaxSize: 20,
            sankeyCaptionColor: "white",
            opacity: 0.8,
            dimmedOpacity: 0.2,
            highlightedOpacity: 1
        },
        hint: {
            clickItem: "",
            clickItems: "",
        }
    })

    const mode = d3.local()
    const focus = d3.local()

    const updateDimensions = selection => {
        selection.each((d, i, nodes) => {
            const leftMargin = -d3.select(nodes[i]).select(".timespans").node().getBBox().x
            const topBottomMargin = -d3.select(nodes[i]).select(".stages .top").node().getBBox().y
            const x = -leftMargin - options.grid.padding
            const y = -topBottomMargin - options.grid.padding
            const width = leftMargin + _.last(selection.datum().stages).x.end + options.grid.padding * 2
            const height = topBottomMargin * 2 + _.last(selection.datum().timespans).y.end + options.grid.padding * 2
            d3.select(nodes[i]).transition()
                .attr("width", width)
                .attr("height", height)
                .attr("viewBox", `${x} ${y} ${width} ${height}`)
            selection.dispatch("layout", { detail: { width, height }})
        })
    }

    const createGradients = selection => {
        const foreground = {
            type: "foreground",
            startColor: options.grid.foregroundColor,
            startOpacity: options.grid.foregroundFade,
            endColor: options.grid.foregroundColor,
            endOpacity: 0
        }
        const data = [foreground, ..._.flatMap(["enter", "exit"], e =>
            _.map(options.types[e], t => ({
                type: t,
                startColor: options.types.color[e == "enter" ? t : "normal"],
                startOpacity: 1,
                endColor: options.types.color[e == "exit" ? t : "normal"],
                stopOpacity: 1
            }))
        )]

        const container = selection.selectAll("defs")
            .data(d => [d])

        const gradient = container.enter()
            .append("defs")
            .merge(container)
            .selectAll("linearGradient")
            .data(data, d => d && d.type)

        const g = gradient.enter()
            .append("linearGradient")
            .attr("id", d => d.type)
            .merge(gradient)
            .attr("x1", "0")
            .attr("x2", "0")
            .attr("y1", "0")
            .attr("y2", "1")

        g.selectAll("stop").remove()

        g.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d => d.startColor)
            .attr("stop-opacity", d => d.startOpacity)

        g.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d => d.endColor)
            .attr("stop-opacity", d => d.endOpacity)
    }

    const splitLink = link => {
        const offset = (ending, off, spread) => ({
            spread,
            ...ending,
            ..._.mapValues(
                _.pick(ending, ["coords", "spreadCoords"]),
                coords => ({
                    x: coords.x + off[0],
                    y: coords.y + off[1]
                })
            )
        })
        return [
            {
                ...link,
                type: link.source.type,
                source: offset(link.source, [0, 0], "source"),
                target: offset(link.source, [0.01, options.link.straightSegmentHeight], "source")
            },
            {
                ...link,
                type: "normal",
                source: offset(link.source, [0.01, options.link.straightSegmentHeight], "source"),
                target: offset(link.target, [-0.01, -options.link.straightSegmentHeight], "target")
            },
            {
                ...link,
                type: link.target.type,
                source: offset(link.target, [-0.01, -options.link.straightSegmentHeight], "target"),
                target: offset(link.target, [0, 0], "target")
            }
        ]
    }

    const linkGenerator = spread => d3.linkVertical()
        .x(d => spread[d.spread] ? d.spreadCoords.x : d.coords.x)
        .y(d => spread[d.spread] ? d.spreadCoords.y : d.coords.y)

    const renderTimespans = selection => {
        const container = selection.selectAll("g.timespans")
            .data(d => [d])

        const timespan = container.enter()
            .append("g")
            .attr("class", "timespans")
            .merge(container)
            .selectAll("g")
            .data(d => d.timespans, d => d.name)

        const oldTimespan = timespan.exit().remove()
        const newTimespan = timespan.enter().append("g")

        newTimespan.append("text")
            .attr("x", d => d.x.start)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "central")
            .attr("font-size", options.grid.fontSize)
            .attr("font-style", "italic")
            .attr("fill", options.grid.labelColor)
            .attr("transform", `translate(-${options.grid.timespanLabelMargin} 0)`)
            .text(d => d.name)
            .merge(timespan.select("text"))
            .attr("y", d => d.y.mid)

        newTimespan.append("line")
            .attr("class", "top")
            .merge(timespan.select("line.top"))
            .attr("stroke", options.grid.color)
            .transition()
            .attr("x1", d => d.x.start)
            .attr("x2", d => d.x.end)
            .attr("y1", d => d.y.start)
            .attr("y2", d => d.y.start)

        newTimespan.append("line")
            .attr("class", "bottom")
            .merge(timespan.select("line.bottom"))
            .attr("stroke", options.grid.color)
            .transition()
            .attr("x1", d => d.x.start)
            .attr("x2", d => d.x.end)
            .attr("y1", d => d.y.end)
            .attr("y2", d => d.y.end)
    }

    const renderStages = selection => {
        const container = selection.selectAll("g.stages")
            .data(d => [d])

        const stage = container.enter()
            .append("g")
            .attr("class", "stages")
            .merge(container)
            .selectAll("g")
            .data(d => d.stages, d => d.name)

        const oldStage = stage.exit().remove()
        const newStage = stage.enter().append("g")

        newStage.append("text")
            .attr("class", "top")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "text-after-edge")
            .attr("font-size", options.grid.fontSize)
            .attr("fill", options.grid.labelColor)
            .attr("transform", `translate(0 -${options.grid.stageLabelMargin})`)
            .text(d => d.name)
            .attr("x", d => d.x.mid)
            .attr("y", d => d.y.start)
        stage.select("text.top")
            .transition()
            .attr("x", d => d.x.mid)

        newStage.append("text")
            .attr("class", "bottom")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "text-before-edge")
            .attr("font-size", options.grid.fontSize)
            .attr("fill", options.grid.labelColor)
            .attr("transform", `translate(0 ${options.grid.stageLabelMargin})`)
            .text(d => d.name)
            .attr("x", d => d.x.mid)
            .attr("y", d => d.y.end)
        stage.select("text.bottom")
            .transition()
            .attr("x", d => d.x.mid)
            .attr("y", d => d.y.end)

        newStage.append("line")
            .attr("class", "left")
            .merge(stage.select("line.left"))
            .attr("stroke", options.grid.color)
            .transition()
            .attr("x1", d => d.x.start)
            .attr("x2", d => d.x.start)
            .attr("y1", d => d.y.start)
            .attr("y2", d => d.y.end)
            .attr("stroke-dasharray", options.continuity ? "none" : `${options.grid.cellHeight},${options.grid.timespanGapHeight}`)

        newStage.append("line")
            .attr("class", "right")
            .merge(stage.select("line.right"))
            .attr("stroke", options.grid.color)
            .transition()
            .attr("x1", d => d.x.end)
            .attr("x2", d => d.x.end)
            .attr("y1", d => d.y.start)
            .attr("y2", d => d.y.end)
            .attr("stroke-dasharray", options.continuity ? "none" : `${options.grid.cellHeight},${options.grid.timespanGapHeight}`)
    }

    const renderSpaghetti = selection => {
        const container = selection.selectAll("g.spaghetti")
            .data(d => [d])

        const item = container.enter()
            .append("g")
            .attr("class", "spaghetti")
            .merge(container)
            .selectAll("g.item")
            .data(d => _.values(d.spaghetti), d => d[0].item.id)

        item.exit().remove()

        const newItem = item.enter()
            .append("g")
            .attr("class", "item")
            .attr("id", d => `item-${d[0].item.id}`)
            .attr("cursor", "pointer")
            .on("mouseenter", d => selection.dispatch("highlight", { detail: new Set([d[0].item.id]) }))
            .on("mouseleave", d => selection.dispatch("highlight", { detail: new Set([]) }))
            .on("click", d => selection.dispatch("itemclick", { detail: [d[0].item] }))

        newItem.append("title")
            .text(options.hint.clickItem)

        const link = newItem
            .append("g")
            .attr("class", "links")
            .merge(item.select("g.links"))
            .selectAll("g")
            .data(d => d)

        link.exit().remove()

        const path = link.enter()
            .append("g")
            .merge(link)
            .selectAll("path")
            .data(splitLink)

        const merged = path.enter()
            .append("path")
            .merge(path)
            .attr("class", d => d.type)
            .attr("fill", "none")
            .attr("stroke", d => d.type == "normal" ? options.types.color.normal : `url(#${d.type})`)
            .attr("stroke-opacity", options.link.opacity)
            .attr("stroke-width", options.link.width)

        const generateLinks = sel =>
            sel.attr("d", (d, i, nodes) => {
                const currentFocus = focus.get(nodes[i])
                return linkGenerator({
                    source: currentFocus.timespanIndex >= 0 &&
                        currentFocus.stageIndex == d.source.stageIndex &&
                        (currentFocus.timespanIndex == d.timespanIndex ||
                        options.continuity && currentFocus.timespanIndex == d.timespanIndex - 1),
                    target: currentFocus.timespanIndex >= 0 &&
                        currentFocus.stageIndex == d.target.stageIndex &&
                        (currentFocus.timespanIndex == d.timespanIndex ||
                        options.continuity && currentFocus.timespanIndex == d.timespanIndex + 1)
                })(d)
            })

        generateLinks(merged)
        selection.on("focuschange.spaghetti", () => generateLinks(merged.transition()))

        const highlight = itemIds => {
            merged.attr("stroke-width", d => options.link.width + (itemIds.has(d.item.id) ? options.link.gapWidth * 2 : 0))
                .transition("highlight").duration(300).ease(d3.easeQuadInOut)
                .attr("stroke-opacity", d =>
                    _.isEmpty(itemIds) ? options.link.opacity :
                    itemIds.has(d.item.id) ? options.link.highlightedOpacity :
                    options.link.dimmedOpacity
                )
        }
        selection.on("highlight.spaghetti", () => highlight(d3.event.detail))

        const opacity = sel =>
            sel.attr("opacity", (d, i, nodes) => mode.get(nodes[i]) == "spaghetti" ? 1 : 0)

        opacity(selection.selectAll("g.spaghetti"))
        selection.on("modechange.spaghetti", () => opacity(selection.selectAll("g.spaghetti").transition()))
    }

    const renderSankey = selection => {
        const container = selection.selectAll("g.sankey")
            .data(d => [d])

        const link = container.enter()
            .append("g")
            .attr("class", "sankey")
            .append("g")
            .attr("class", "links")
            .merge(container.select("g.links"))
            .selectAll("g")
            .data(d => d.sankey, d => d.groupId)

        link.exit().remove()

        const path = link.enter()
            .append("g")
            .merge(link)
            .selectAll("path")
            .data(splitLink)

        path.enter()
            .append("path")
            .merge(path)
            .transition()
            .attr("class", d => d.type)
            .attr("fill", "none")
            .attr("stroke", d => d.type == "normal" ? options.types.color.normal : `url(#${d.type})`)
            .attr("stroke-opacity", options.link.opacity)
            .attr("stroke-width", d => (options.link.width + 2 * options.link.gapWidth) * d.count)
            .attr("d", linkGenerator({ source: false, target: false }))

        const opacity = sel =>
            sel.attr("opacity", (d, i, nodes) => mode.get(nodes[i]) == "sankey" ? 1 : 0)

        opacity(selection.selectAll("g.sankey"))
        selection.on("modechange.sankey", () => opacity(selection.selectAll("g.sankey").transition()))
    }

    const renderSpaghettiCaptions = selection => {
        const container = selection.selectAll("g.spaghettiCaptions")
            .data(d => [d])

        const cell = container.enter()
            .append("g")
            .attr("class", "spaghettiCaptions")
            .merge(container)
            .selectAll("g.cell")
            .data(d => _.values(d.captions))

        cell.exit().remove()

        const mergedCell = cell.enter()
            .append("g")
            .attr("class", "cell")
            .merge(cell)

        const cellOpacity = sel => {
            sel.attr("opacity", (d, i, nodes) => {
                const currentFocus = focus.get(nodes[i])
                return currentFocus.timespanIndex == d[0].timespanIndex &&
                    currentFocus.stageIndex == d[0].stageIndex ? 1 : 0
            })
        }
        cellOpacity(mergedCell)
        selection.on("focuschange.cells", () => cellOpacity(mergedCell.transition()))

        const caption = mergedCell
            .selectAll("g.caption")
            .data(d => _.values(d))

        caption.exit().remove()

        const newCaption = caption.enter()
            .append("g")
            .attr("class", "caption")

        newCaption.append("title")
            .text(options.hint.clickItems)

        newCaption.append("text")

        const merged = newCaption.merge(caption)
            .select("text")
            .attr("class", d => `${d.type} ${d.ending}`)
            .text(d => d.count)
            .attr("cursor", "pointer")
            .attr("fill", d => options.types.captionColor[d.type] || options.types.color[d.type])
            .attr("opacity", options.caption.opacity)
            .attr("dominant-baseline", d => d.ending == "source" ? "text-before-edge" : "text-after-edge")
            .attr("text-anchor", d => d.ending == "source" ? "start" : "end")
            .attr("font-size", options.caption.spaghettiCaptionSize)
            .attr("x", d => d.spaghettiCoords.x)
            .attr("y", d => d.spaghettiCoords.y)
            .on("mouseenter", d => selection.dispatch("highlight", { detail: d.itemIds }))
            .on("mouseleave", d => selection.dispatch("highlight", { detail: new Set([]) }))
            .on("click", d => selection.dispatch("itemclick", { detail: d.items }))

        const highlight = itemIds => {
            merged.attr("stroke", (d, i, nodes) => _.isEqual(d.itemIds, itemIds) ? d3.select(nodes[i]).attr("fill") : "none")
                .transition("highlight").duration(300).ease(d3.easeQuadInOut)
                .attr("opacity", d =>
                    _.isEmpty(itemIds) ? options.caption.opacity :
                    _.isEqual(d.itemIds, itemIds) ? options.caption.highlightedOpacity :
                    options.caption.dimmedOpacity
                )
        }
        selection.on("highlight.captions", () => highlight(d3.event.detail))

        const opacity = sel =>
            sel.attr("opacity", (d, i, nodes) => mode.get(nodes[i]) == "spaghetti" ? 1 : 0)

        opacity(selection.selectAll("g.spaghettiCaptions"))
        selection.on("modechange.spaghettiCaptions", () => opacity(selection.selectAll("g.spaghettiCaptions").transition()))
    }

    const renderSankeyCaptions = selection => {
        const container = selection.selectAll("g.sankeyCaptions")
            .data(d => [d])

        const cell = container.enter()
            .append("g")
            .attr("class", "sankeyCaptions")
            .merge(container)
            .selectAll("g.cell")
            .data(d => _.values(d.captions))

        cell.exit().remove()

        const mergedCell = cell.enter()
            .append("g")
            .attr("class", "cell")
            .merge(cell)
            .attr("opacity", d => d[0].timespanIndex == selection.datum().timespans.length - 1 ? 1 : 0)

        const caption = mergedCell
            .selectAll("g.caption")
            .data(d => _.values(d))

        caption.exit().remove()

        const newCaption = caption.enter()
            .append("g")
            .attr("class", "caption")

        newCaption.append("text")

        newCaption.merge(caption)
            .select("text")
            .attr("class", d => `${d.type} ${d.ending}`)
            .text(d => d.count)
            .attr("opacity", d => d.count > 1 && d.type == "normal" && d.ending == "target" ? 1 : 0)
            .attr("fill", d => options.caption.sankeyCaptionColor)
            .attr("dominant-baseline", d => d.ending == "source" ? "text-before-edge" : "text-after-edge")
            .attr("text-anchor", "middle")
            .attr("font-size", 20)
            .attr("font-size", (d, i, nodes) => Math.min(
                options.caption.sankeyCaptionMaxSize,
                0.7 * d.count * options.link.width * 20 / nodes[i].getComputedTextLength()
            ))
            .attr("x", d => d.sankeyCoords.x)
            .attr("y", d => d.sankeyCoords.y)

        const opacity = sel =>
            sel.attr("opacity", (d, i, nodes) => mode.get(nodes[i]) == "sankey" ? 1 : 0)

        opacity(selection.selectAll("g.sankeyCaptions"))
        selection.on("modechange.sankeyCaptions", () => opacity(selection.selectAll("g.sankeyCaptions").transition()))
    }

    const renderForeground = selection => {
        const container = selection.selectAll("rect.foreground")
            .data(d => [d])

        container.enter()
            .append("rect")
            .attr("class", "foreground")
            .attr("pointer-events", "none")
            .attr("fill", "url(#foreground)")
            .merge(container)
            .attr("width", d => d.stages[d.stages.length-1].x.end)
            .attr("height", d => d.timespans[d.timespans.length-1].y.end)
    }

    const setupFocus = selection => {
        selection.each((d, i, nodes) => focus.set(nodes[i], { timespanIndex: -1, stageIndex: -1 }))
        selection.on("mousemove.focus", (d, i, nodes) => {
            const mouse = d3.mouse(nodes[i])
            const timespanIndex = _.minBy(d.timespans, ts =>
                Math.min(Math.abs(ts.y.start + 1 - mouse[1]), Math.abs(ts.y.end - 1 - mouse[1]))
            ).index
            const stageIndex = _.minBy(d.stages, st =>
                Math.min(Math.abs(st.x.start + 1 - mouse[0]), Math.abs(st.x.end - 1 - mouse[0]))
            ).index
            const currentFocus = focus.get(nodes[i])
            if (timespanIndex != currentFocus.timespanIndex || stageIndex != currentFocus.stageIndex) {
                focus.set(nodes[i], { timespanIndex, stageIndex })
                d3.select(nodes[i]).dispatch("focuschange")
            }
        })
        selection.on("mouseleave.focus", (d, i, nodes) => {
            focus.set(nodes[i], { timespanIndex: -1, stageIndex: -1 })
            d3.select(nodes[i]).dispatch("focuschange")
        })
    }

    const setupModeChange = selection => {
        selection.each((d, i, nodes) => mode.set(nodes[i], "sankey"))
        selection.on("mousemove.mode", (d, i, nodes) => {
            if (mode.get(nodes[i]) != "spaghetti") {
                mode.set(nodes[i], "spaghetti")
                d3.select(nodes[i]).dispatch("modechange")
            }
        })
        selection.on("mouseleave.mode", (d, i, nodes) => {
            mode.set(nodes[i], "sankey")
            d3.select(nodes[i]).dispatch("modechange")
        })
    }

    return {
        process: data => ({
            ...data,
            ...computePipeline(data, options)
        }),
        render: selection => {
            selection
                .call(createGradients)
                .call(renderTimespans)
                .call(renderStages)
                .call(updateDimensions)
                .call(setupFocus)
                .call(setupModeChange)
                .call(renderSankey)
                .call(renderSpaghetti)
                .call(renderSankeyCaptions)
                .call(renderSpaghettiCaptions)
                .call(renderForeground)
        }
    }
}
