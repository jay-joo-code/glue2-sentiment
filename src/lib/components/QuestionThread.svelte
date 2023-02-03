<script lang="ts">
	import IconUpArrow from '$lib/icons/glue/IconUpArrow.svelte';
	import getTopicKeyword from '$lib/util/getTopicKeyword';
	import { differenceInDays, format, formatDistance } from 'date-fns';
	import highlightWords from 'highlight-words';
	import Showdown from 'showdown';
	import ComingSoonButton from './glue/ComingSoonButton.svelte';

	export let thread;
	export let topic;

	let keyword = getTopicKeyword(topic);

	const converter = new Showdown.Converter();
	converter?.setOption('openLinksInNewWindow', true);

	const formatDate = (obj) => {
		const date = obj?.providerCreated || obj?.created;
		if (!date) return '';

		if (differenceInDays(new Date(), new Date(date)) > 7) {
			return format(new Date(date), 'yyyy-MM-dd hh:mm aaa');
		} else {
			return `${formatDistance(new Date(), new Date(date))} ago`;
		}
	};

	const formatContent = (content: string) => {
		const chunks = highlightWords({
			text: converter.makeHtml(content) || '',
			query: keyword,
			matchExactly: true,
			clipBy: false
		});
		return chunks
			?.map((chunk) => {
				if (chunk?.match) {
					return `<a href="/topic/${topic?.id}" class="decoration-primary underline decoration-2 !text-base-content">${chunk?.text}</a>`;
				}
				return chunk?.text;
			})
			?.join('');
	};
</script>

<div class="space-y-4 border-b border-base-300 py-8">
	<p class="inline text-xl font-semibold [&>p:first-of-type]:inline">
		Q. {@html `${formatContent(thread?.title)}`}
	</p>
	<article class="prose prose-a:text-blue-600">
		{@html formatContent(thread?.content)}
	</article>
	<p class="mt-0.5 text-sm text-base-content/80">
		{formatDate(thread)}
	</p>
	{#if thread?.answers?.length > 0}
		<div class="space-y-6 pt-2">
			{#each thread?.answers as answer (answer?.id)}
				<div class="space-y-3 border-l-2 border-primary/80 pl-5">
					<article class="prose break-words prose-a:text-blue-600">
						{@html formatContent(answer?.content)}
					</article>
					<div class="flex items-center space-x-2">
						<ComingSoonButton
							variant="click-helpful"
							class="btn-xs btn gap-2 rounded-full"
							context={answer}
						>
							<IconUpArrow />
							{answer?.helpfulCount} Helpful
						</ComingSoonButton>
						<p class="mt-0.5 text-sm text-base-content/80">
							{formatDate(answer)}
						</p>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
