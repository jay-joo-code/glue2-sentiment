<script lang="ts">
	import { pb } from '$lib/glue/pocketbase';
	import IconAdd from '$lib/icons/glue/IconAdd.svelte';
	import getTopicKeyword from '$lib/util/getTopicKeyword';
	import axios from 'axios';
	import { onMount } from 'svelte';
	import ComingSoon from './glue/ComingSoonButton.svelte';
	import QuestionThread from './QuestionThread.svelte';

	export let topic;

	let keyword = getTopicKeyword(topic);

	let questionThreads = [];
	let isScraped = false;
	let isLoading = true;
	$: isLoading = questionThreads?.length === 0 && !isScraped;

	const scrapeQAFromReddit = async () => {
		const { data } = await axios(
			`https://www.reddit.com/r/Cornell/search/.json?q=${encodeURIComponent(
				topic?.name
			)}&limit=30&restrict_sr=1&sr_nsfw=`
		);

		const promises = data?.data?.children?.map(async ({ data }) => {
			const { selftext, title, permalink } = data;

			// TODO: format required substring (ie dont require the full name)
			// clubs -> remove "club", "at cornell" from the end

			if (
				(selftext?.toLowerCase()?.includes(keyword) || title?.toLowerCase()?.includes(keyword)) &&
				(selftext?.includes('?') || title?.includes('?'))
			) {
				const { data: postData } = await axios.get(`https://www.reddit.com${permalink}.json`);

				const questionRawData = postData[0]?.data?.children[0]?.data;
				const { id, selftext, created_utc, media_metadata } = questionRawData;

				if (media_metadata || title?.includes('[deleted]') || selftext?.includes('[deleted]'))
					return null;

				// NOTE: because a question can be for multiple topics
				const providerId = `${topic?.id}-${id}`;

				const questionData = {
					title,
					content: selftext,
					provider: 'reddit',
					providerId,
					providerData: questionRawData,
					providerUrl: `https://www.reddit.com${permalink}`,
					topic: topic?.id,
					providerCreated: new Date(created_utc * 1000)
				};

				let question;

				try {
					question = await pb
						.collection('questions')
						.getFirstListItem(`providerId='${providerId}'`, { $autoCancel: false });
					question = await pb
						.collection('questions')
						.update(question?.id, questionData, { $autoCancel: false });
				} catch (error) {
					question = await pb.collection('questions').create(questionData, { $autoCancel: false });
				}
				question.answers = [];

				if (postData?.length >= 2) {
					const comments = postData[1]?.data?.children;

					for (let i = 0; i < comments?.length; i++) {
						const commentDataRaw = comments[i]?.data;
						const { body, id, permalink, score, created_utc } = commentDataRaw;
						const providerId = `${topic?.id}-${id}`;

						if (body?.includes('[deleted]')) return null;

						if (score >= 1) {
							const answerData = {
								content: body,
								provider: 'reddit',
								providerId,
								providerData: commentDataRaw,
								providerUrl: `https://www.reddit.com${permalink}`,
								helpfulCount: score,
								topic: topic?.id,
								question: question?.id,
								providerCreated: new Date(created_utc * 1000)
							};

							let answer;

							try {
								answer = await pb
									.collection('answers')
									.getFirstListItem(`providerId='${providerId}'`, { $autoCancel: false });
								answer = await pb
									.collection('answers')
									.update(answer?.id, answerData, { $autoCancel: false });
							} catch (error) {
								answer = await pb.collection('answers').create(answerData, { $autoCancel: false });
							}
							question?.answers?.push(answer);
						}
					}
				}

				return question;
			}
		});

		const scrapedQuestionThreads = await Promise.all(promises);
		const existingQuestionIds = questionThreads?.map((question) => question?.id);
		const newQuestionThreads = scrapedQuestionThreads?.filter(
			(question) => question && !existingQuestionIds?.includes(question?.id)
		);
		questionThreads = [...questionThreads, ...newQuestionThreads];
		isScraped = true;
	};

	const fetchQAFromDB = async () => {
		const questions = await pb.collection('questions').getFullList(200, {
			filter: `topic='${topic?.id}'`,
			// NOTE: doesn't sort by providerCreated
			sort: '-created'
		});
		const promises = questions?.map(async (question) => {
			const answers = await pb.collection('answers').getFullList(200, {
				filter: `question='${question?.id}'`,
				$autoCancel: false
			});
			return {
				...question,
				answers
			};
		});
		questionThreads = await Promise.all(promises);
	};

	onMount(() => {
		fetchQAFromDB();
		scrapeQAFromReddit();
	});
</script>

<div class="">
	<p class="mb-6 text-3xl font-semibold">Discussions ({questionThreads?.length})</p>
	<ComingSoon variant="click-create-post" class="btn-primary" context={topic}
		><IconAdd /> Create post</ComingSoon
	>

	{#if isLoading}
		<div class="space-y-10 py-8">
			<div class="space-y-4">
				<div class="h-8 w-full animate-pulse rounded-xl bg-base-300" />
				<div class="h-24 w-full animate-pulse rounded-xl bg-base-300" />
			</div>
			<div class="space-y-4">
				<div class="h-8 w-full animate-pulse rounded-xl bg-base-300" />
				<div class="h-24 w-full animate-pulse rounded-xl bg-base-300" />
			</div>
			<div class="space-y-4">
				<div class="h-8 w-full animate-pulse rounded-xl bg-base-300" />
				<div class="h-24 w-full animate-pulse rounded-xl bg-base-300" />
			</div>
		</div>
	{/if}

	<div class="">
		{#each questionThreads as thread (thread?.id)}
			<QuestionThread {thread} {topic} />
		{/each}
	</div>
</div>
