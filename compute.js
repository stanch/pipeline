const computePipeline = (data, options) => {
    const links = spaghettiSankey(data.items)

    const spreadOptions = _.set(
        _.cloneDeep(options),
        "link.width", options.link.width + 2 * options.link.gapWidth
    )
    const sankeyOptions = _.set(
        _.cloneDeep(spreadOptions),
        "link.gapWidth", 0
    )

    const spaghettiOffsets = linkOffsets(links.spaghetti, options)
    const spaghettiSpreadOffsets = linkOffsets(links.spaghetti, spreadOptions)
    const sankeyOffsets = linkOffsets(links.sankey, sankeyOptions)

    const bounds = gridBounds(data.timespans, data.stages, spaghettiSpreadOffsets, options)
    const captions = cellCaptions(spaghettiOffsets, bounds, options)

    const spaghetti = _.mapValues(
        _.groupBy(
            linkCoordinates(
                linkCoordinates(links.spaghetti, spaghettiOffsets, bounds, "coords"),
                spaghettiSpreadOffsets, bounds, "spreadCoords"
            ),
            "item.id"
        ),
        links => _.sortBy(links, "timespanIndex")
    )

    const sankey = linkCoordinates(links.sankey, sankeyOffsets, bounds, "coords")

    return {spaghetti, sankey, ...bounds, captions}
}

const spaghettiSankey = items => {
    const spaghetti = _.flatMap(items, item =>
        _.map(item.timespans, timespan => {
            const source = {
                ..._.first(timespan.stages),
                type: timespan.enter ? _.keys(timespan.enter)[0] : "normal"
            }
            const target = {
                ..._.last(timespan.stages),
                type: timespan.exit ? _.keys(timespan.exit)[0] : "normal"
            }
            return {
                item: item,
                timespanIndex: timespan.timespanIndex,
                count: 1,
                source,
                target,
                groupId: `${timespan.timespanIndex}-${source.stageIndex}-${source.type}-${target.stageIndex}-${target.type}`
            }
        })
    )

    const sankey = _.map(
        _.values(_.groupBy(spaghetti, "groupId")),
        links => ({
            groupId: links[0].groupId,
            items: _.map(links, "item"),
            timespanIndex: links[0].timespanIndex,
            count: links.length,
            source: _.omit(links[0].source, "since"),
            target: _.omit(links[0].target, "since")
        })
    )

    return {spaghetti, sankey}
}

const linkEnding = (link, ending) => ({
    ..._.omit(link, ["source.coords", "target.coords"]),
    ..._.omit(link[ending], "coords"),
    ending,
    oppositeEnding: ending == "source" ? "target" : "source"
})

const linkOffsets = (links, options) => {
    const typeOrder = {
        source: _.invert([...options.types.enter, "normal"]),
        target: _.invert(["normal", ...options.types.exit])
    }

    const linkEndings = _.flatMap(
        links,
        link => [linkEnding(link, "source"), linkEnding(link, "target")]
    )

    const sortLinks = links => _.sortBy(links, [
        link => +typeOrder[link.ending][link.type],
        link => link.since ? -link.since : 1,
        link => link[link.oppositeEnding].stageIndex,
        link => +typeOrder[link.oppositeEnding][link[link.oppositeEnding].type]
    ])

    return _.map(
        _.values(
            _.groupBy(
                linkEndings,
                ending => `${ending.timespanIndex}-${ending.stageIndex}-${ending.ending}`
            )
        ),
        endings => ({
            ..._.pick(endings[0], ["timespanIndex", "stageIndex", "ending"]),
            ...offset(
                sortLinks(endings), options.link.width, options.link.gapWidth, options.link.groupGapWidth,
                options.continuity ? "normal" : ""
            )
        })
    )
}

const gridBounds = (timespans, stages, offsets, options) => {
    const bounds = (sizes, gap) => _.reduce(sizes,
        (acc, size) => {
            const start = _.last(acc) ? _.last(acc).end + gap : 0
            return [...acc, {start: start, mid: start + size/2, end: start + size}]
        }, []
    )

    const terminalBounds = bounds => ({
        start: _.first(bounds).start,
        end: _.last(bounds).end
    })

    const offsetsByStage = _.groupBy(offsets, "stageIndex")

    const stageWidths = stages.map((stage, stageIndex) => {
        const offs = offsetsByStage[stageIndex]
        if (_.isEmpty(offs)) return options.grid.cellWidth
        const left = Math.abs(_.minBy(offs, "left").left)
        const right = _.maxBy(offs, "right").right
        const widest = Math.max(left, right) * 2 + options.grid.linkCellGapWidth * 2
        return Math.max(widest, options.grid.cellWidth)
    })

    const stageBounds = bounds(stageWidths, 0)
    const timespanBounds = bounds(
        timespans.map(_ => options.grid.cellHeight),
        !options.continuity * options.grid.timespanGapHeight
    )

    return {
        stages: _.zipWith(
            stages, stageBounds, _.range(stages.length),
            (stage, b, i) => ({...stage, index: i, x: b, y: terminalBounds(timespanBounds)})
        ),
        timespans: _.zipWith(
            timespans, timespanBounds, _.range(timespans.length),
            (timespan, b, i) => ({...timespan, index: i, y: b, x: terminalBounds(stageBounds)})
        )
    }
}

const linkCoordinates = (links, offsets, bounds, type) => {
    const offsetsByLinkEnding = _.keyBy(
        offsets,
        offset => `${offset.timespanIndex}-${offset.stageIndex}-${offset.ending}`
    )

    const linkEndingOffset = (link, ending) =>
        offsetsByLinkEnding[`${link.timespanIndex}-${link[ending].stageIndex}-${ending}`]
            .itemCenter(linkEnding(link, ending))

    const linkEndingCoordinates = (link, ending) => ({
        x: bounds.stages[link[ending].stageIndex].x.mid + linkEndingOffset(link, ending),
        y: bounds.timespans[link.timespanIndex].y[ending == "source" ? "start" : "end"]
    })

    return links.map(link => ({
        ...link,
        source: {...link.source, [type]: linkEndingCoordinates(link, "source")},
        target: {...link.target, [type]: linkEndingCoordinates(link, "target")}
    }))
}

const cellCaptions = (offsets, bounds, options) => {
    const spaghettiCoords = (offset, group, i) => ({
        x: bounds.stages[offset.stageIndex]
            .x[offset.ending == "source" ? "start" : "end"] +
            (offset.ending == "source" ? 1 : -1) * 2 * options.caption.spaghettiCaptionGapHeight,
        y: bounds.timespans[offset.timespanIndex]
            .y[offset.ending == "source" ? "start" : "end"] +
            (offset.ending == "source" ? 1 : -1) *
            (i * options.caption.spaghettiCaptionSize + (i + 1) * options.caption.spaghettiCaptionGapHeight)
    })

    const sankeyCoords = (offset, group, i) => ({
        x: bounds.stages[offset.stageIndex].x.mid +
            group.center,
        y: bounds.timespans[offset.timespanIndex]
            .y[offset.ending == "source" ? "start" : "end"]
    })

    return _.mapValues(
        _.groupBy(offsets, offset => `${offset.timespanIndex}-${offset.stageIndex}`),
        offsets => _.flatMap(offsets, offset => {
            const groups = offset.ending == "source" ?
                _.reverse(offset.groups) : offset.groups
            return _.map(groups, (group, i) => ({
                ..._.pick(offset, ["timespanIndex", "stageIndex", "ending"]),
                ..._.omit(group, ["center", "items"]),
                items: _.map(group.items, "item"),
                itemIds: new Set(_.map(group.items, "item.id")),
                spaghettiCoords: spaghettiCoords(offset, group, i),
                sankeyCoords: sankeyCoords(offset, group, i)
            }))
        })
    )
}
