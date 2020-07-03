# Introduction

This is a pipeline visualization inspired by [Sankey diagrams](https://en.wikipedia.org/wiki/Sankey_diagram) and [this diagram by the New York Times](http://www.nytimes.com/newsgraphics/2013/11/30/football-conferences/index.html), which I will call a _spaghetti diagram_.

It has been originally developed to analyze a recruiting pipeline&nbsp;— people passing from one stage to another over time&nbsp;— but can be applied to other use cases.

You can play with a live demo [here](https://stanch.github.io/pipeline/).

<p align="middle">
  <img src="images/light.png" height="200"/>
  <img src="images/dark.png" height="200"/>
  <br/>
  <img src="images/light-spaghetti.png" height="200"/>
  <img src="images/dark-spaghetti.png" height="200"/>
</p>

# Features

Let’s use recruiting as an example:
* On the horizontal axis, each column is a stage that a candidate can pass through during the recruiting process.
* On the vertical axis, each row is a week (but could be any other unit of time).
* Lines represent candidates. They are colored <span style="color: #08f;">blue</span> when the candidate enters the pipeline, <span style="color: #f80;">orange</span> when the candidate fails a stage and <span style="color: #8fe240;">green</span> when the candidate passes the final stage and is hired.

The pipeline diagram combines several views, including both Sankey and spaghetti modes, in one interactive visualization. _What kind of questions can it answer?_

<p align="middle">
  <img src="images/demo.gif"/>
</p>

## Flowing or stagnant?

In a well-oiled, flowing pipeline you will notice significant horizontal motion:

<img src="images/flowing.png" height="150"/>

On the other hand, if nobody is passing from one stage to another, the diagram will be dominated by straight vertical lines:

<img src="images/stagnant.png" height="150"/>

A line crossing other lines could be another sign that something is stuck. This is because at each stage, the candidates are ordered by the time they reached the stage. So in the ideal world, the ones on the right&nbsp;— the first to arrive&nbsp;— would also be the first to advance:

<img src="images/overtaking.png" height="150"/>

## Big or small?

Looking at the width of different stages quickly reveals the size of the pipeline. The last row includes the current numbers.

<img src="images/size.png" height="150"/>

## Growing or shrinking?

<img align="left" src="images/growth.png" height="150"/>

<img align="left" src="images/carry-over.png" height="150"/>

Focus on the width of <span style="color: #08f;">blue</span> accents each week&nbsp;— you can tell whether the number of new candidates is decreasing or increasing over time.

The disconnected mode&nbsp;— which works better for large pipelines&nbsp;— also makes it easier to see how many candidates are <span style="color: #08f;">new</span> and how many <span style="color: #888;">carried over</span> from the previous week.

<span style="clear: both;">&nbsp;</span>

## Easy or hard?

The width of <span style="color: #f80;">orange</span> accents gives an idea of which stages have higher fail rates.

<img src="images/fail-rate.png" height="200"/>

## What happened to?..

By hovering on individual lines or on the numbers that appear in each cell, you can investigate the paths of specific candidates.

<p>
<img src="images/trace-forward.png" height="250"/>
<img src="images/trace-back.png" height="250"/>
</p>

# Usage

See [the demo source code](https://github.com/stanch/pipeline/blob/master/index.html#L54) for an example. Note: I’ve developed this project a while back as a part of a larger project, and never needed to publish it. I am happy to look into publishing on NPM if there is any interest though :)
